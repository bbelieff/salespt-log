/** Payment heading whitespace only; native controls and portal DOM own their actions. */
export function shouldTogglePaymentHeader(heading: HTMLElement, target: EventTarget | null): boolean {
  return target instanceof Element && heading.contains(target) &&
    !target.closest('button,input,select,textarea,a,label,[role="button"],[role="link"],[contenteditable],[data-font-scale-control]');
}
