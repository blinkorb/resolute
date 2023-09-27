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
  activeElementPath: readonly number[],
  prevTagName: string | undefined
) => {
  if (typeof prevTagName === 'undefined') {
    return;
  }

  const [index, ...rest] = activeElementPath;

  if (typeof index === 'undefined') {
    if (
      element instanceof HTMLElement &&
      element.tagName.toLowerCase() === prevTagName
    ) {
      element?.focus();
    }
    return;
  }

  reFocusActiveElement(element?.children[index], rest, prevTagName);
};
