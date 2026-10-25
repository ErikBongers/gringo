import { defineConfig } from 'rolldown'

// noinspection JSUnusedGlobalSymbols
export default defineConfig({
    input:  "./typescript/totalsTab.ts",
    output: {
        file: "generated/totalsTab.js",
        format: "iife",
        sourcemap: true,
    },
    tsconfig: "./tsconfig_totals_tab.json"
})