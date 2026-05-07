import next from "@walform/eslint-config/next";

export default [
  ...next,
  {
    ignores: [".next/**", "out/**", "next-env.d.ts"],
  },
];
