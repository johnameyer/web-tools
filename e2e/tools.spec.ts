import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { tools } from '../src/tools';

// Hash routing: tools live at /#/<path>
async function open(page: Page, path: string): Promise<void> {
  await page.goto(`/#/${path}`);
}

/** Replaces the contents of the CodeMirror editor with the given label. */
async function fillEditor(page: Page, label: string, text: string): Promise<void> {
  const editor = page.getByLabel(label, { exact: true }).locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(text);
}

function editorText(page: Page, label: string) {
  return page.getByLabel(label, { exact: true }).locator('.cm-content');
}

test.describe('every tool', () => {
  test('is listed on the home page', async ({ page }) => {
    await page.goto('/');
    for (const tool of tools) {
      await expect(page.getByRole('link', { name: tool.title })).toBeVisible();
    }
  });

  for (const tool of tools) {
    test(`${tool.title} renders without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error') {
          errors.push(message.text());
        }
      });

      await page.goto('/');
      await page.getByRole('link', { name: tool.title }).click();
      await expect(page).toHaveURL(new RegExp(`#/${tool.path}$`));
      await expect(page.getByRole('progressbar')).toHaveCount(0);
      await expect(page.locator('main')).not.toBeEmpty();
      expect(errors).toEqual([]);
    });
  }
});

test.describe('Base64', () => {
  test('encodes, decodes and reports invalid input', async ({ page }) => {
    await open(page, 'base64');
    await page.getByLabel('Input').fill('héllo ✓');
    await expect(page.getByLabel('Output')).toHaveValue('aMOpbGxvIOKckw==');

    await page.getByText('Decode', { exact: true }).click();
    await page.getByLabel('Input').fill('aMOpbGxvIOKckw==');
    await expect(page.getByLabel('Output')).toHaveValue('héllo ✓');

    await page.getByLabel('Input').fill('not*base64!');
    await expect(page.getByText('not valid Base64')).toBeVisible();
  });
});

test.describe('URI', () => {
  test('encodes in component and full modes', async ({ page }) => {
    await open(page, 'uri');
    await page.getByLabel('Input').fill('https://example.com/a b?q=é');
    await expect(page.getByLabel('Output')).toHaveValue('https%3A%2F%2Fexample.com%2Fa%20b%3Fq%3D%C3%A9');

    await page.getByText('Full URI', { exact: true }).click();
    await expect(page.getByLabel('Output')).toHaveValue('https://example.com/a%20b?q=%C3%A9');
  });
});

test.describe('JSON prettify', () => {
  test('formats, minifies and flags invalid JSON', async ({ page }) => {
    await open(page, 'json-format');
    await fillEditor(page, 'JSON', '{"b":1,"a":[1,2]}');
    // Paste formatting is covered separately; typing inserts text without reformatting
    await page.getByRole('button', { name: 'Format', exact: true }).click();
    await expect(editorText(page, 'JSON')).toContainText('"a": [');

    await page.getByRole('button', { name: 'Minify' }).click();
    await expect(editorText(page, 'JSON')).toHaveText('{"b":1,"a":[1,2]}');

    await fillEditor(page, 'JSON', '{"a":');
    await expect(page.getByText('Invalid JSON')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Format', exact: true })).toBeDisabled();
  });

  test('formats pasted JSON', async ({ page, context }) => {
    await context.grantPermissions([ 'clipboard-read', 'clipboard-write' ]);
    await open(page, 'json-format');
    await page.evaluate(() => navigator.clipboard.writeText('{"x":{"y":1}}'));
    await editorText(page, 'JSON').click();
    await page.keyboard.press('ControlOrMeta+v');
    await expect(editorText(page, 'JSON')).toContainText('"y": 1');
  });

  test('collapses and expands nested blocks', async ({ page }) => {
    await open(page, 'json-format');
    await fillEditor(page, 'JSON', '{"outer":{"inner":{"deep":1}}}');
    await page.getByRole('button', { name: 'Format', exact: true }).click();
    await expect(editorText(page, 'JSON')).toContainText('"deep": 1');

    await page.getByRole('button', { name: 'Collapse all' }).click();
    await expect(editorText(page, 'JSON')).not.toContainText('"deep": 1');

    await page.getByRole('button', { name: 'Expand all' }).click();
    await expect(editorText(page, 'JSON')).toContainText('"deep": 1');
  });
});

test.describe('JSON Schema', () => {
  test('validator reports errors with paths', async ({ page }) => {
    await open(page, 'json-schema-validator');
    await fillEditor(page, 'Schema', '{"type":"object","required":["name"],"properties":{"age":{"type":"integer"}}}');
    await fillEditor(page, 'Data', '{"age":"x"}');
    await expect(page.getByText('2 validation errors')).toBeVisible();
    await expect(page.getByText('/age')).toBeVisible();

    await fillEditor(page, 'Data', '{"name":"Ada","age":3}');
    await expect(page.getByText('The data matches the schema.')).toBeVisible();
  });

  test('editor validates the starter example and reacts to edits', async ({ page }) => {
    await open(page, 'json-schema-editor');
    await expect(page.getByText('The data matches the schema.')).toBeVisible();

    await fillEditor(page, 'Sample data', '{"age":-1}');
    await expect(page.getByText('2 validation errors')).toBeVisible();
  });

  test('editor flags a keyword with the wrong type', async ({ page }) => {
    await open(page, 'json-schema-editor');
    await fillEditor(page, 'Schema', '{"type":"object","minLength":"x"}');
    await expect(page.locator('.cm-lintRange-error').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Timestamp', () => {
  test('converts epoch seconds in a chosen timezone', async ({ page }) => {
    await open(page, 'timestamp');
    await page.getByLabel('Timestamp').fill('1700000000');
    await expect(page.getByText('Unix epoch in seconds')).toBeVisible();
    await expect(page.getByText('2023-11-14T22:13:20.000Z', { exact: true })).toBeVisible();

    await page.getByRole('combobox', { name: 'Timezone' }).fill('Asia/Kolkata');
    await page.getByRole('option', { name: 'Asia/Kolkata' }).click();
    await expect(page.getByText('2023-11-15T03:43:20.000+05:30')).toBeVisible();
  });

  test('rejects an impossible date', async ({ page }) => {
    await open(page, 'timestamp');
    await page.getByLabel('Timestamp').fill('2024-02-30');
    await expect(page.getByText('That date or time does not exist')).toBeVisible();
  });
});

test.describe('JWT', () => {
  // {"alg":"HS256","typ":"JWT"} . {"sub":"1234567890","name":"John Doe","iat":1516239022} signed with "your-256-bit-secret"
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

  test('decodes a token and verifies its signature', async ({ page }) => {
    await open(page, 'jwt');
    await page.getByLabel('Token').fill(token);
    await expect(page.getByText('"name": "John Doe"')).toBeVisible();
    await expect(page.getByText('2018-01-18T01:30:22.000Z')).toBeVisible();

    await page.getByLabel('Secret', { exact: true }).fill('wrong-secret');
    await expect(page.getByText('Invalid signature')).toBeVisible();

    await page.getByLabel('Secret', { exact: true }).fill('your-256-bit-secret');
    await expect(page.getByText('Signature verified')).toBeVisible();
  });

  test('explains a malformed token', async ({ page }) => {
    await open(page, 'jwt');
    await page.getByLabel('Token').fill('only.two');
    await expect(page.getByText('3 dot-separated parts')).toBeVisible();
  });
});
