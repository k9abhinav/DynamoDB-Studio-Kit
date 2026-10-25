/** Monaco theme colors accept #RRGGBB, and reject the three-digit form. */
export function monacoColor(value: string): string | undefined {
  const color = value.trim();
  const short = /^#([\da-fA-F])([\da-fA-F])([\da-fA-F])$/.exec(color);
  if (short !== null) {
    const red = short[1];
    const green = short[2];
    const blue = short[3];
    if (red === undefined || green === undefined || blue === undefined) {
      return undefined;
    }
    return `#${red}${red}${green}${green}${blue}${blue}`;
  }
  if (/^#[\da-fA-F]{6}([\da-fA-F]{2})?$/.test(color)) {
    return color;
  }
  return undefined;
}
