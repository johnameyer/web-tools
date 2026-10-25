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

test.describe('navigation', () => {
  test('home page lists every tool', async ({ page }) => {
    await page.goto('/');
    for (const tool of tools) {
      await expect(page.locator('main').getByRole('link', { name: tool.title })).toBeVisible();
    }
  });

  test('side nav links to every tool and marks the current one', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Tools' });
    for (const tool of tools) {
      await expect(nav.getByRole('link', { name: tool.title })).toBeVisible();
    }
    await nav.getByRole('link', { name: 'JWT decoder' }).click();
    await expect(page).toHaveURL(/#\/jwt$/);
    await expect(nav.getByRole('link', { name: 'JWT decoder' })).toHaveAttribute('data-active', 'true');
    await expect(nav.getByRole('link', { name: 'Home' })).not.toHaveAttribute('data-active', 'true');
  });

  test('collapses behind a burger on narrow screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Tools' });
    // Slid off-screen, and removed from the tab order and accessibility tree
    await expect(nav).not.toBeInViewport();
    await expect(nav).toHaveAttribute('inert', '');
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      expect(await nav.evaluate(el => el.contains(document.activeElement))).toBe(false);
    }

    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await expect(nav).toBeInViewport();
    await expect(nav).not.toHaveAttribute('inert');
    await nav.getByRole('link', { name: 'Base64 encode / decode' }).click();
    await expect(page).toHaveURL(/#\/base64$/);
    await expect(nav).not.toBeInViewport();
  });
});

test.describe('every tool', () => {
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
      await page.getByRole('navigation', { name: 'Tools' }).getByRole('link', { name: tool.title })
        .click();
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

test.describe('Hash', () => {
  const ABC_MD5 = '900150983cd24fb0d6963f7d28e17f72';
  const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

  test('hashes text and switches output format', async ({ page }) => {
    await open(page, 'hash');
    await page.getByRole('textbox', { name: 'Text' }).fill('abc');
    await expect(page.getByText(ABC_MD5)).toBeVisible();
    await expect(page.getByText(ABC_SHA256)).toBeVisible();

    await page.getByText('HEX', { exact: true }).click();
    await expect(page.getByText(ABC_MD5.toUpperCase())).toBeVisible();
    await page.getByText('Base64', { exact: true }).click();
    await expect(page.getByText('kAFQmDzST7DWlj99KOF/cg==')).toBeVisible();
  });

  test('computes an HMAC with a key', async ({ page }) => {
    await open(page, 'hash');
    await page.getByRole('textbox', { name: 'Text' }).fill('what do ya want for nothing?');
    await page.getByLabel('HMAC').check();
    await page.getByLabel('Secret key').fill('Jefe');
    await expect(page.getByText('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843')).toBeVisible();
    await expect(page.getByText('HMAC-SHA-256')).toBeVisible();
  });

  test('hashes a chosen file', async ({ page }) => {
    await open(page, 'hash');
    await page.getByText('File', { exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({ name: 'abc.txt', mimeType: 'text/plain', buffer: Buffer.from('abc') });
    await expect(page.getByText(ABC_MD5)).toBeVisible();
    await expect(page.getByText('abc.txt · 3 B')).toBeVisible();
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
