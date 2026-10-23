import { contrastRatio } from "../../lib/contrast.js";
import { contrastPairs, darkColors, lightColors, type SchemeColors } from "../../styles/tokens.js";

export function TokenTable({ scheme, colors }: { scheme: string; colors: SchemeColors }) {
  return (
    <table className="w-full border-collapse text-left text-sm">
      <caption className="py-2 text-left font-medium">{scheme} contrast</caption>
      <thead>
        <tr className="border-b border-outline">
          <th className="py-2">Pair</th>
          <th>Ratio</th>
          <th>Sample</th>
        </tr>
      </thead>
      <tbody>
        {contrastPairs(colors).map((pair) => (
          <tr key={pair.name} className="border-b border-outline">
            <td className="py-2">{pair.name}</td>
            <td className="font-mono">
              {contrastRatio(pair.foreground, pair.background).toFixed(2)}
            </td>
            <td>
              <span
                className="inline-block rounded px-2 py-1"
                style={{ color: pair.foreground, backgroundColor: pair.background }}
              >
                Aa
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TokenTables() {
  return (
    <div className="grid gap-8">
      <TokenTable scheme="Light" colors={lightColors} />
      <TokenTable scheme="Dark" colors={darkColors} />
    </div>
  );
}
