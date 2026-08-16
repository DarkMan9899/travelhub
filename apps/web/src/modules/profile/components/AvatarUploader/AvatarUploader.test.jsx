import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AvatarUploader from './AvatarUploader.jsx';

const PNG_FILE = new File(['x'], 'avatar.png', { type: 'image/png' });
const PDF_FILE = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
const OVERSIZED_FILE = new File([new Uint8Array(11 * 1024 * 1024)], 'big.png', {
  type: 'image/png',
});

function setup(props = {}) {
  const onUpload = vi.fn();
  const onValidationError = vi.fn();
  render(
    <AvatarUploader
      name="Ana Smith"
      userId="1"
      isUploading={false}
      onUpload={onUpload}
      onValidationError={onValidationError}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
    />,
  );
  return { onUpload, onValidationError };
}

describe('AvatarUploader (apps/web/src/modules/profile)', () => {
  test('clicking the avatar opens the hidden file input', async () => {
    const user = userEvent.setup();
    setup();
    const input = document.querySelector('input[type="file"]');
    const clickSpy = vi.spyOn(input, 'click');

    await user.click(
      screen.getByRole('button', { name: 'Փոխել պրոֆիլի նկարը' }),
    );
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  test('a valid image calls onUpload', async () => {
    const user = userEvent.setup();
    const { onUpload, onValidationError } = setup();
    const input = document.querySelector('input[type="file"]');

    await user.upload(input, PNG_FILE);

    expect(onUpload).toHaveBeenCalledWith(PNG_FILE);
    expect(onValidationError).not.toHaveBeenCalled();
  });

  test('an unsupported file type calls onValidationError, not onUpload', () => {
    // `userEvent.upload` honors the input's `accept` attribute and won't
    // set a disallowed file (matching real browser file-picker behavior)
    // — `fireEvent.change` bypasses that to exercise the component's own
    // JS-level guard, the real defense against a drag/paste bypass.
    const { onUpload, onValidationError } = setup();
    const input = document.querySelector('input[type="file"]');

    fireEvent.change(input, { target: { files: [PDF_FILE] } });

    expect(onUpload).not.toHaveBeenCalled();
    expect(onValidationError).toHaveBeenCalledWith(
      'Խնդրում ենք ընտրել JPEG, PNG կամ WebP պատկեր։',
    );
  });

  test('an oversized file calls onValidationError, not onUpload', async () => {
    const user = userEvent.setup();
    const { onUpload, onValidationError } = setup();
    const input = document.querySelector('input[type="file"]');

    await user.upload(input, OVERSIZED_FILE);

    expect(onUpload).not.toHaveBeenCalled();
    expect(onValidationError).toHaveBeenCalledWith(
      'Խնդրում ենք ընտրել 10 ՄԲ-ից փոքր պատկեր։',
    );
  });

  test('the trigger is disabled while uploading', () => {
    setup({ isUploading: true });
    expect(
      screen.getByRole('button', { name: 'Փոխել պրոֆիլի նկարը' }),
    ).toBeDisabled();
  });
});
