// eslint-disable-next-line import/no-mutable-exports
export let shadowWrapper: HTMLElement | null = null

export function setSelectionShadowWrapper(wrapper: HTMLElement | null) {
  shadowWrapper = wrapper
}
