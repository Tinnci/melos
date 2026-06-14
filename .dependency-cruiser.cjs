/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
    forbidden: [
        {
            name: "no-circular",
            severity: "error",
            from: {},
            to: {
                circular: true
            }
        },
        {
            name: "core-is-foundation",
            severity: "error",
            from: {
                path: "^packages/core/"
            },
            to: {
                path: "^packages/(?!core/)"
            }
        },
        {
            name: "source-adapters-depend-on-core-only",
            severity: "error",
            from: {
                path: "^packages/(converter|mei|mnx)/"
            },
            to: {
                path: "^packages/(renderer|player|web|playground)/"
            }
        },
        {
            name: "renderer-does-not-import-format-or-ui-layers",
            severity: "error",
            from: {
                path: "^packages/renderer/"
            },
            to: {
                path: "^packages/(converter|mei|mnx|player|web|playground)/"
            }
        },
        {
            name: "player-does-not-import-renderer-or-ui-layers",
            severity: "error",
            from: {
                path: "^packages/player/"
            },
            to: {
                path: "^packages/(converter|mei|mnx|renderer|web|playground)/"
            }
        },
        {
            name: "library-packages-do-not-import-web",
            severity: "error",
            from: {
                path: "^packages/(core|converter|mei|mnx|renderer|player)/"
            },
            to: {
                path: "^packages/web/"
            }
        },
        {
            name: "source-does-not-import-build-output",
            severity: "error",
            from: {
                path: "^packages/"
            },
            to: {
                path: "/dist/"
            }
        }
    ],
    options: {
        tsConfig: {
            fileName: "tsconfig.json"
        },
        doNotFollow: {
            path: "node_modules"
        },
        exclude: {
            path: "node_modules|dist|coverage|\\.codex-research"
        },
        reporterOptions: {
            dot: {
                collapsePattern: "node_modules/[^/]+"
            }
        }
    }
};
