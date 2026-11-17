/**
 * The only place that touches localStorage. JSON in / out, never throws
 * (private mode, quota, blocked storage → read returns null, write returns false).
 * Keys are namespaced by the caller: `<slug>:<name>:v<version>`.
 */
function getStore(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function parse(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export const storage = {
  read(key: string): unknown {
    try {
      return parse(getStore()?.getItem(key) ?? null);
    } catch {
      return null;
    }
  },

  write(key: string, value: unknown): boolean {
    try {
      const store = getStore();
      if (!store) return false;
      store.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  remove(key: string): void {
    try {
      getStore()?.removeItem(key);
    } catch {
      // storage unavailable: nothing to remove
    }
  },

  /** Changes made in other tabs (the `storage` event never fires in the tab that wrote). */
  subscribe(key: string, listener: (value: unknown) => void): () => void {
    if (typeof window === 'undefined') return () => undefined;
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) listener(parse(event.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  },
};

function getSessionStore(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Small per-tab flags in sessionStorage (e.g. "already reloaded for a chunk error"). Never throws. */
export const sessionFlag = {
  get(name: string): string | null {
    try {
      return getSessionStore()?.getItem(`flag:${name}`) ?? null;
    } catch {
      return null;
    }
  },
  set(name: string, value: string): void {
    try {
      getSessionStore()?.setItem(`flag:${name}`, value);
    } catch {
      // storage unavailable: the guard just doesn't persist
    }
  },
  remove(name: string): void {
    try {
      getSessionStore()?.removeItem(`flag:${name}`);
    } catch {
      // nothing to remove
    }
  },
};
