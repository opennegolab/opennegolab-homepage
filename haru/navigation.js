// Browser and in-app back share the same sequence of visited screens.
export function screenHistory(capture, restore) {
  const session = performance.timeOrigin;
  const screens = [];
  let index = 0;
  history.replaceState({ haruSession: session, haruScreen: index }, '');

  window.addEventListener('popstate', ({ state }) => {
    if (state?.haruSession !== session) return;
    screens[index] = capture();
    index = state.haruScreen;
    restore(screens[index]);
  });

  return {
    get hasPrevious() { return index > 0; },
    push() {
      screens[index] = capture();
      screens.length = index + 1;
      history.pushState({ haruSession: session, haruScreen: ++index }, '');
    },
    back() {
      if (index > 0) history.back();
      else if (history.length > 1 && document.referrer) history.back();
      else window.location.replace('/haru');
    }
  };
}
