export const getActiveElementPath = (
  activeElement: Element | null,
  activeElementPath: readonly number[]
): readonly number[] => {
  if (
    !activeElement ||
    activeElement === globalThis.document.body ||
    !activeElement.parentElement
  ) {
    return activeElementPath;
  }

  const index = [...activeElement.parentElement.children].indexOf(
    activeElement
  );

  return getActiveElementPath(activeElement.parentElement, [
    index,
    ...activeElementPath,
  ]);
};

export const reFocusActiveElement = (
  element: Element | undefined,
  activeElementPath: readonly number[]
) => {
  const [index, ...rest] = activeElementPath;

  if (typeof index === 'undefined') {
    if (element instanceof HTMLElement) {
      element?.focus();
    }
    return;
  }

  reFocusActiveElement(element?.children[index], rest);
};
