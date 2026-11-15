/** The parts of an HTMLVideoElement the controller touches (a seam for tests). */
export type VideoLike = {
  src: string;
  muted: boolean;
  loop: boolean;
  playsInline: boolean;
  crossOrigin: string | null;
  preload: string;
  play(): Promise<void> | void;
  pause(): void;
  load(): void;
  removeAttribute(name: string): void;
};

/**
 * The one video in a headset session (design brief section 9: only one video plays at a
 * time). Pulling another card stops the current loop and swaps the source on the same
 * element; stop() clears the source so nothing keeps playing or downloading.
 */
export function createVideoController(make: () => VideoLike = () => document.createElement("video")) {
  let el: VideoLike | null = null;
  let current: string | null = null;

  const element = () => {
    if (!el) {
      el = make();
      el.muted = true;
      el.loop = true;
      el.playsInline = true;
      el.crossOrigin = "anonymous";
      el.preload = "none";
    }
    return el;
  };

  return {
    element,
    get current() {
      return current;
    },
    /** Resolves true once playing, false if the browser blocked it (the card still shows). */
    async play(src: string): Promise<boolean> {
      const video = element();
      if (current !== src) {
        if (current) video.pause();
        video.src = src;
        current = src;
      }
      try {
        await video.play();
        return true;
      } catch {
        return false;
      }
    },
    stop() {
      if (!el) return;
      el.pause();
      el.removeAttribute("src");
      el.load();
      current = null;
    },
  };
}

export type VideoController = ReturnType<typeof createVideoController>;
