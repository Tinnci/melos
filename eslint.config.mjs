import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
    { files: ["**/*.{js,mjs,cjs,ts}"] },
    { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
            "@typescript-eslint/naming-convention": [
                "warn",
                {
                    "selector": "typeLike",
                    "format": ["PascalCase"]
                },
                {
                    "selector": "enumMember",
                    "format": ["PascalCase", "UPPER_CASE"]
                },
                {
                    "selector": "variableLike",
                    "format": ["camelCase", "PascalCase", "UPPER_CASE"],
                    "leadingUnderscore": "allow"
                }
            ],
            "complexity": ["warn", 12],
            "max-depth": ["warn", 4],
            "max-lines": [
                "warn",
                {
                    "max": 700,
                    "skipBlankLines": true,
                    "skipComments": true
                }
            ],
            "max-lines-per-function": [
                "warn",
                {
                    "max": 120,
                    "skipBlankLines": true,
                    "skipComments": true
                }
            ],
            "max-params": ["warn", 5]
        }
    },
    {
        ignores: [
            "**/node_modules/",
            "**/dist/",
            ".codex-research/**",
            "scripts/",
            "packages/*/renderer/src/index.js"
        ]
    }
];
