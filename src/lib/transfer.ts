'use client';

export type StoryboardTransferSource = 'query' | 'session';

const STORYBOARD_SESSION_KEY = 'novel_to_script_storyboard_transfer';
const MAX_INLINE_QUERY_LENGTH = 1800;

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function readSessionScript() {
  if (!canUseSessionStorage()) {
    return null;
  }

  try {
    return window.sessionStorage.getItem(STORYBOARD_SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSessionScript(scriptText: string) {
  if (!canUseSessionStorage()) {
    return false;
  }

  try {
    window.sessionStorage.setItem(STORYBOARD_SESSION_KEY, scriptText);
    return true;
  } catch {
    return false;
  }
}

function clearSessionScript() {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(STORYBOARD_SESSION_KEY);
  } catch {
    // Ignore storage cleanup failures and continue with navigation.
  }
}

export function buildStoryboardTransferTarget(scriptText: string) {
  const trimmedScript = scriptText.trim();
  if (!trimmedScript) {
    return { href: '/storyboard', source: null as StoryboardTransferSource | null };
  }

  const encodedScript = encodeURIComponent(trimmedScript);
  if (encodedScript.length <= MAX_INLINE_QUERY_LENGTH) {
    return {
      href: `/storyboard?script=${encodedScript}`,
      source: 'query' as const,
    };
  }

  if (writeSessionScript(trimmedScript)) {
    return {
      href: '/storyboard?transfer=session',
      source: 'session' as const,
    };
  }

  return {
    href: `/storyboard?script=${encodedScript}`,
    source: 'query' as const,
  };
}

export function resolveStoryboardTransfer(searchParams: Pick<URLSearchParams, 'get'>) {
  const inlineScript = searchParams.get('script');
  if (inlineScript) {
    try {
      return {
        scriptText: decodeURIComponent(inlineScript),
        source: 'query' as const,
      };
    } catch {
      return {
        scriptText: inlineScript,
        source: 'query' as const,
      };
    }
  }

  if (searchParams.get('transfer') === 'session') {
    const sessionScript = readSessionScript();
    clearSessionScript();

    if (sessionScript) {
      return {
        scriptText: sessionScript,
        source: 'session' as const,
      };
    }
  }

  return {
    scriptText: null,
    source: null as StoryboardTransferSource | null,
  };
}
