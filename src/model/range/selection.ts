/**
 * Something about the Selection/Range API in browsers.
 * If you want to use Highlighter in some old browsers, you may use a polyfill.
 * https://caniuse.com/#search=selection
 */

export const getDomRange = (): Range => {
    const selection = window.getSelection();

    if (selection.isCollapsed) {
        // eslint-disable-next-line no-console
        console.debug('no text selected');

        return null;
    }

    return selection.getRangeAt(0);
};

export const removeSelection = (): void => {
    window.getSelection().removeAllRanges();
};

/**
 * Get text from a Range with proper newline handling for block elements.
 * Uses innerText on a cloned fragment to get clean output matching Selection.toString().
 * Range.toString() includes HTML source whitespace, this method gives user-expected output.
 * Falls back to range.toString() in environments where innerText isn't available (e.g. jsdom).
 */
export const getTextFromRange = (range: Range): string => {
    // Try innerText approach for proper newline handling in real browsers
    try {
        const fragment = range.cloneContents();
        const temp = document.createElement('div');

        // Position off-screen but keep visible - innerText returns empty for hidden elements!
        temp.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
        document.body.appendChild(temp);
        temp.appendChild(fragment);

        const text = temp.innerText;

        temp.remove();

        // innerText may be undefined in jsdom, or empty if something went wrong
        if (text) {
            return text;
        }
    } catch (e: unknown) {
        // Fall through to fallback
    }

    // Fallback to range.toString() (loses proper newline handling but works everywhere)
    return range.toString();
};
