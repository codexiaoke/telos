window.__ModuleLoader__.load({
	id: "@telos/dsh-client-ui-sidebar",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region ../../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region \0dsh-css:/Users/xiaoke/code/project/telos/third_party/deepseek-harness/packages/client/ui-sidebar/src/client/SidebarRoot.module.css.mjs
		const css = ".telosSidebar_root{--dsh-sidebar-inline-padding:16px;height:100%;padding:var(--telos-sidebar-top-inset,6px) var(--dsh-sidebar-inline-padding);box-sizing:border-box;background:var(--dsw-specific-sidebar-fill);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);flex-direction:column;font-size:14px;display:flex;position:relative}.telosSidebar_root.telosSidebar_collapsed{padding:var(--telos-sidebar-rail-top-inset,18px) 10px 6px}.telosSidebar_root.telosSidebar_quietBars{--dsh-scrollbar-thumb:transparent;--dsh-scrollbar-thumb-hover:transparent}.telosSidebar_fading>*{opacity:0;transition:opacity .15s var(--ds-ease-in-out)}.telosSidebar_wide{animation:telosSidebar_wide-in .2s var(--ds-ease-in-out)}@keyframes telosSidebar_wide-in{0%{opacity:0}}.telosSidebar_railIn .telosSidebar_iconButton,.telosSidebar_railIn .telosSidebar_newSession,.telosSidebar_railIn .telosSidebar_regionArea{animation:telosSidebar_rail-in .15s var(--ds-ease-in-out) backwards}.telosSidebar_railIn .telosSidebar_footArea{animation:telosSidebar_rail-fade-in .15s var(--ds-ease-in-out) backwards}@keyframes telosSidebar_rail-in{0%{opacity:0;transform:translate(49px)}}@keyframes telosSidebar_rail-fade-in{0%{opacity:0}}.telosSidebar_logoRow{box-sizing:border-box;flex:none;align-items:center;height:82px;margin-bottom:4px;padding:0;display:flex;position:relative;overflow:visible;-webkit-app-region:drag}.telosSidebar_collapsed .telosSidebar_logoRow{justify-content:flex-start;height:36px;margin-bottom:12px;padding:0}.telosSidebar_brand{min-width:0;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;align-items:baseline;padding:0;display:inline-flex;position:absolute;left:8px;bottom:0;overflow:visible;cursor:default;user-select:none}.telosSidebar_iconButton{cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex;-webkit-app-region:no-drag}.telosSidebar_logoRow .telosSidebar_toggle{position:absolute;z-index:7;top:12px;right:80px}.telosSidebar_iconButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.telosSidebar_collapsed .telosSidebar_iconButton{width:36px;height:36px}.telosSidebar_collapsed .telosSidebar_toggle .telosSidebar_panelIcon{display:none}.telosSidebar_collapsed .telosSidebar_toggle:hover .telosSidebar_panelIcon{display:inline}.telosSidebar_collapsed .telosSidebar_toggle:hover .telosSidebar_railFish{display:none}.telosSidebar_collapsed .telosSidebar_iconButton{color:var(--dsw-alias-label-primary)}.telosSidebar_newSession{box-sizing:border-box;border:0;background:transparent;height:44px;color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:12px;flex:none;justify-content:flex-start;align-items:center;gap:10px;margin:0 0 10px;padding:0 12px;font-size:16px;font-weight:500;line-height:22px;display:flex;overflow:hidden;-webkit-app-region:no-drag}.telosSidebar_newSession:hover{background:var(--dsw-alias-interactive-bg-hover)}.telosSidebar_collapsed .telosSidebar_newSession{background:0 0;border-color:#0000;align-self:flex-start;gap:0;width:36px;height:36px;margin:0 0 12px;padding:0}.telosSidebar_collapsed .telosSidebar_newSession:hover{background:var(--dsw-alias-interactive-bg-hover)}.telosSidebar_newSessionLabel{white-space:nowrap;max-width:200px;overflow:hidden}.telosSidebar_collapsed .telosSidebar_newSessionLabel{max-width:0}.telosSidebar_regionArea{min-height:0;margin-left:-4px;margin-right:calc(-1 * var(--dsh-sidebar-inline-padding));flex-direction:column;flex:1;padding-left:4px;display:flex;overflow:visible}.telosSidebar_collapsed .telosSidebar_regionArea{margin-left:0;margin-right:0;padding-left:0}.telosSidebar_footArea{flex-direction:column;flex:none;display:flex}.telosSidebar_settingsArea,.telosSidebar_footerActions{flex:none;width:100%;min-width:0}.telosSidebar_footerActions{display:flex}.telosSidebar_collapsed .telosSidebar_footArea{align-items:center}.telosSidebar_collapsed .telosSidebar_settingsArea,.telosSidebar_collapsed .telosSidebar_footerActions{justify-content:center;width:auto;display:flex}@media (prefers-reduced-motion:reduce){.telosSidebar_wide,.telosSidebar_fading>*,.telosSidebar_railIn .telosSidebar_iconButton,.telosSidebar_railIn .telosSidebar_newSession,.telosSidebar_railIn .telosSidebar_footArea,.telosSidebar_railIn .telosSidebar_regionArea{transition:none;animation:none}}";
		const tagId = "@telos/dsh-client-ui-sidebar/SidebarRoot.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@telos/dsh-client-ui-sidebar";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SidebarRoot_module_css_default = {
			"panelIcon": "telosSidebar_panelIcon",
			"toggle": "telosSidebar_toggle",
			"newSessionLabel": "telosSidebar_newSessionLabel",
			"rail-fade-in": "telosSidebar_rail-fade-in",
			"railIn": "telosSidebar_railIn",
			"root": "telosSidebar_root",
			"wide-in": "telosSidebar_wide-in",
			"footArea": "telosSidebar_footArea",
			"logoRow": "telosSidebar_logoRow",
			"brand": "telosSidebar_brand",
			"collapsed": "telosSidebar_collapsed",
			"wide": "telosSidebar_wide",
			"newSession": "telosSidebar_newSession",
			"rail-in": "telosSidebar_rail-in",
			"iconButton": "telosSidebar_iconButton",
			"settingsArea": "telosSidebar_settingsArea",
			"quietBars": "telosSidebar_quietBars",
			"fading": "telosSidebar_fading",
			"regionArea": "telosSidebar_regionArea",
			"railFish": "telosSidebar_railFish",
			"footerActions": "telosSidebar_footerActions"
		};
		//#endregion
		//#region lib/types/client/SidebarRoot.js
		/**
		* Sidebar shell: column geometry only. Collapse is a slide plus crossfade:
		* content freezes at its expanded width (inline style) and fades out in place
		* while the sliding column (AppFrame grid tracks) clips it — nothing reflows
		* mid-slide. At settle the wide-only content unmounts and the four upper
		* controls enter the 56px rail from the same horizontal offset (one icon each,
		* same top-down order) on one fade that ends with the slide. The bottom-pinned
		* settings control only fades. The workspace/session browsing region between
		* the New Session button and the foot is the `sidebar.workspaces` registrant's,
		* and the foot holds `sidebar.settings` plus `sidebar.footer.action`; the shell
		* hands them the wide flag (plus an expand request callback for the browser).
		*
		* The column also owns whether the scroll regions nested in it draw a
		* scrollbar at all: the shell tracks the pointer and rebinds ui-theme's
		* scrollbar indirection away while it is elsewhere, so a list the user is not
		* pointing at carries no bar.
		*/
		/** Wide-content unmount delay; matches the 150ms wide-content fade-out. */
		const COLLAPSE_SETTLE_MS = 150;
		/**
		* How long the column's scrollbars stay drawn after the pointer leaves it.
		* The bar is a pointer affordance here, and hiding it on the leave event
		* itself makes it blink out while the pointer is only crossing the column's
		* edge — on the way to the conversation, or around a portalled menu.
		*/
		const SCROLLBAR_LINGER_MS = 2e3;
		/**
		* Render the sidebar column shell.
		* @param props - composed slot props (runtime share + injected callbacks, contract/slots.ts).
		* @returns the sidebar element tree.
		*/
		function SidebarRoot({ collapsed, width, startSession, toggleSidebar, t, renderSlot }) {
			const [settled, setSettled] = (0, react.useState)(collapsed);
			(0, react.useEffect)(() => {
				if (!collapsed) {
					setSettled(false);
					return;
				}
				const timer = window.setTimeout(() => {
					setSettled(true);
				}, COLLAPSE_SETTLE_MS);
				return () => {
					window.clearTimeout(timer);
				};
			}, [collapsed]);
			const wide = !collapsed || !settled;
			const lastWideWidth = (0, react.useRef)(width);
			if (!collapsed) lastWideWidth.current = width;
			const everWide = (0, react.useRef)(!collapsed);
			if (!collapsed) everWide.current = true;
			const column = (0, react.useRef)(null);
			const [pointerInside, setPointerInside] = (0, react.useState)(false);
			const lingerTimer = (0, react.useRef)(void 0);
			const armLinger = () => {
				if (lingerTimer.current !== void 0) return;
				lingerTimer.current = window.setTimeout(() => {
					lingerTimer.current = void 0;
					setPointerInside(false);
				}, SCROLLBAR_LINGER_MS);
			};
			const cancelLinger = () => {
				window.clearTimeout(lingerTimer.current);
				lingerTimer.current = void 0;
			};
			(0, react.useEffect)(() => {
				if (!pointerInside) return;
				const onMove = (event) => {
					const rect = column.current?.getBoundingClientRect();
					/* v8 ignore next -- the listener only exists while the column is mounted and revealed. */
					if (rect === void 0) return;
					if (event.clientX >= rect.left && event.clientX < rect.right && event.clientY >= rect.top && event.clientY < rect.bottom) cancelLinger();
					else armLinger();
				};
				document.addEventListener("pointermove", onMove);
				return () => {
					document.removeEventListener("pointermove", onMove);
					cancelLinger();
				};
			}, [pointerInside]);
			return (0, react_jsx_runtime.jsxs)("div", {
				ref: column,
				className: clsx(SidebarRoot_module_css_default.root, !wide && SidebarRoot_module_css_default.collapsed, !wide && everWide.current && SidebarRoot_module_css_default.railIn, collapsed && wide && SidebarRoot_module_css_default.fading, !pointerInside && SidebarRoot_module_css_default.quietBars),
				style: wide ? { width: collapsed ? lastWideWidth.current : width } : void 0,
				onPointerEnter: () => {
					cancelLinger();
					setPointerInside(true);
				},
				onPointerLeave: () => {
					armLinger();
				},
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: SidebarRoot_module_css_default.logoRow,
						children: [wide && (0, react_jsx_runtime.jsx)("div", {
							className: clsx(SidebarRoot_module_css_default.brand, SidebarRoot_module_css_default.wide),
							"aria-label": "Telos v0.1.2",
							children: (0, react_jsx_runtime.jsxs)("span", {
								style: { display: "inline-flex", alignItems: "baseline", gap: "6px" },
								children: [(0, react_jsx_runtime.jsx)("span", {
									style: { fontSize: "16px", lineHeight: "22px", fontWeight: 650, letterSpacing: "-0.01em" },
									children: "Telos"
								}), (0, react_jsx_runtime.jsx)("span", {
									style: { fontSize: "13px", lineHeight: "18px", fontWeight: 450 },
									children: "v0.1.2"
								})]
							})
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: collapsed ? t("toggle.open") : t("toggle.collapse"),
							delayMs: 500,
							children: (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: clsx(SidebarRoot_module_css_default.iconButton, SidebarRoot_module_css_default.toggle),
								"aria-label": collapsed ? t("toggle.open") : t("toggle.collapse"),
								onClick: () => {
									toggleSidebar();
								},
								children: [!wide && (0, react_jsx_runtime.jsx)("span", {
									className: SidebarRoot_module_css_default.railFish,
									style: { fontSize: "17px", lineHeight: "24px", fontWeight: 750 },
									children: "T"
								}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPanelLeftOutline16, {
									className: SidebarRoot_module_css_default.panelIcon,
									size: wide ? 16 : 18
								})]
							})
						})]
					}),
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
						label: t("session.new.label"),
						delayMs: 500,
						disabled: wide,
						children: (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: SidebarRoot_module_css_default.newSession,
							"aria-label": t("session.new.label"),
							onClick: () => {
								startSession();
							},
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconNewChatOutline16, { size: wide ? 14 : 18 }), wide && (0, react_jsx_runtime.jsx)("span", {
								className: clsx(SidebarRoot_module_css_default.newSessionLabel, SidebarRoot_module_css_default.wide),
								children: t("session.new")
							})]
						})
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: SidebarRoot_module_css_default.regionArea,
						children: renderSlot("sidebar.workspaces", {
							wide,
							expandSidebar: () => {
								if (collapsed) toggleSidebar();
							}
						})
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: SidebarRoot_module_css_default.footArea,
						children: [(0, react_jsx_runtime.jsx)("div", {
							className: SidebarRoot_module_css_default.footerActions,
							children: renderSlot("sidebar.footer.action", { wide })
						}), (0, react_jsx_runtime.jsx)("div", {
							className: SidebarRoot_module_css_default.settingsArea,
							children: renderSlot("sidebar.settings", { wide })
						})]
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** `sidebar` namespace dictionaries: shell controls (brand row, New Session, fold toggle). */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"session.new": "新会话",
			"session.new.label": "新建会话",
			"toggle.open": "打开侧边栏",
			"toggle.collapse": "收起侧边栏"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"session.new": "New Session",
			"session.new.label": "New session",
			"toggle.open": "Open sidebar",
			"toggle.collapse": "Collapse sidebar"
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Dictionary namespace owned by this plugin (shell controls copy). */
		const NS = "sidebar";
		/** Services required by the sidebar plugin. */
		const inject = [
			"slots",
			"layout",
			"sessions",
			"workspaces",
			"locale"
		];
		/** Registers the sidebar shell and its service callbacks.
		* @param ctx - Client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-sidebar: dictionaries");
			const injectProps = () => ({
				startSession: (workspaceId) => {
					ctx.workspaces.startSession(workspaceId);
				},
				toggleSidebar: () => {
					ctx.layout.toggleSidebar();
				}
			});
			ctx.effect(() => ctx.slots.register({
				name: "sidebar",
				locale: NS,
				children: {
					"sidebar.workspaces": {
						kind: "single",
						scope: "root"
					},
					"sidebar.settings": {
						kind: "single",
						scope: "root"
					},
					"sidebar.footer.action": {
						kind: "list",
						scope: "root"
					}
				},
				inject: injectProps
			}, SidebarRoot), "ui-sidebar: slot registration");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

