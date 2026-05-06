const SPECIAL_TOKEN_MAP = {
  ENTER: { type: "special", key: "ENTER" },
  TAB: { type: "special", key: "TAB" },
  BACKSPACE: { type: "special", key: "BACKSPACE" },
  ESC: { type: "special", key: "ESC" }
};

function parseScript(script) {
  const result = [];
  const regex = /\{([^{}]+)\}/g;
  let cursor = 0;
  let match = regex.exec(script);

  while (match) {
    const tokenStart = match.index;
    const tokenEnd = regex.lastIndex;

    if (tokenStart > cursor) {
      result.push({
        type: "text",
        value: script.slice(cursor, tokenStart)
      });
    }

    const rawToken = match[1].trim();
    const parsedToken = parseBraceToken(rawToken);

    if (parsedToken) {
      result.push(parsedToken);
    } else {
      // Unknown brace syntax is treated as literal text for safety/predictability.
      result.push({
        type: "text",
        value: script.slice(tokenStart, tokenEnd)
      });
    }

    cursor = tokenEnd;
    match = regex.exec(script);
  }

  if (cursor < script.length) {
    result.push({
      type: "text",
      value: script.slice(cursor)
    });
  }

  return result;
}

function parseBraceToken(rawToken) {
  const upper = rawToken.toUpperCase();
  if (SPECIAL_TOKEN_MAP[upper]) {
    return SPECIAL_TOKEN_MAP[upper];
  }

  if (upper.includes("+")) {
    const comboParts = upper.split("+").map((part) => part.trim());
    if (comboParts.every(Boolean)) {
      return {
        type: "combo",
        keys: comboParts
      };
    }
  }

  return null;
}

module.exports = {
  parseScript
};
