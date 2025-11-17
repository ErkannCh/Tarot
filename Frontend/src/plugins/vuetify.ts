// src/plugins/vuetify.ts
// Vuetify styles (typed); some environments flag TS on path.
// Use type-ignore to bypass build-time resolution issues.
// @ts-ignore
import "vuetify/styles";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { aliases, mdi } from "vuetify/iconsets/mdi";

export default createVuetify({
	components,
	directives,
	icons: {
		defaultSet: "mdi",
		aliases,
		sets: {
			mdi,
		},
	},
	theme: {
		defaultTheme: "tarotDark",
		themes: {
			// Use fixed hex colors for Vuetify (avoids CSS var warnings)
			tarotDark: {
				dark: true,
				colors: {
					// Surfaces
					background: "#0b0d14",
					surface: "#111423",
					// Brand palette
					primary: "#7c3aed",
					secondary: "#06b6d4",
					info: "#60a5fa",
					success: "#22c55e",
					warning: "#f59e0b",
					error: "#ef4444",
					// On colors
					"on-background": "#e5e7eb",
					"on-surface": "#e5e7eb",
				},
			},
		},
	},
});
