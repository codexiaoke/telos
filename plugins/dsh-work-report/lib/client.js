window.__ModuleLoader__.load({
  id: "@telos/dsh-work-report",
  factory: (require) => {
    var module = { exports: {} };
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  WorkReportClientController: () => WorkReportClientController,
  WorkReportSettingsSection: () => WorkReportSettingsSection,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/contracts.ts
var WORK_REPORT_RPC_CHANNEL = "/telos-work-report";

// src/client/controller.ts
var EMPTY = { loading: false, reports: [] };
function message(error) {
  return error instanceof Error ? error.message : String(error);
}
var WorkReportClientController = class {
  constructor(rpc) {
    this.rpc = rpc;
  }
  snapshot = EMPTY;
  listeners = /* @__PURE__ */ new Set();
  getSnapshot = () => this.snapshot;
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  async refresh() {
    await this.run(async () => {
      const [settings, reports] = await Promise.all([
        this.call("snapshot", {}),
        this.call("list-reports", { limit: 50 })
      ]);
      this.update({ settings, reports, loading: false });
    });
  }
  async saveStandard(type, content) {
    await this.run(async () => {
      const settings = await this.call("save-standard", { type, content });
      this.update({ settings, loading: false, notice: "\u62A5\u544A\u89C4\u8303\u5DF2\u4FDD\u5B58" });
    });
  }
  async saveDirectory(directory) {
    await this.run(async () => {
      const settings = await this.call("save-directory", directory);
      this.update({ settings, loading: false, notice: "\u8054\u7CFB\u4EBA\u548C\u5206\u7EC4\u5DF2\u4FDD\u5B58" });
    });
  }
  async saveMail(config, password) {
    await this.run(async () => {
      const settings = await this.call("save-mail", {
        config,
        ...password === void 0 ? {} : { password }
      });
      this.update({ settings, loading: false, notice: password === null ? "SMTP \u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u5BC6\u7801\u5DF2\u6E05\u9664" : "SMTP \u914D\u7F6E\u5DF2\u4FDD\u5B58" });
    });
  }
  async call(endpoint, payload) {
    const result = await this.rpc.call(WORK_REPORT_RPC_CHANNEL, endpoint, payload);
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
    return result.value;
  }
  async run(operation) {
    this.update({ loading: true, error: void 0, notice: void 0 });
    try {
      await operation();
    } catch (error) {
      this.update({ loading: false, error: message(error) });
    }
  }
  update(patch) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
};

// src/client/styles.ts
var WORK_REPORT_CLIENT_CSS = String.raw`
.telosReportSettings{box-sizing:border-box;width:100%;height:100%;overflow:auto;padding:6px 0 36px;color:var(--dsw-alias-label-primary)}
.telosReportHeader,.telosReportPanelHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.telosReportHeader{margin-bottom:18px}.telosReportHeader h1,.telosReportPanel h2{margin:0 0 5px;font-size:18px}.telosReportHeader p,.telosReportPanelHeader p{max-width:760px;margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.6}
.telosReportSettings button{min-height:32px;padding:5px 11px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:inherit;cursor:pointer}.telosReportSettings button[data-primary]{border-color:transparent;background:var(--dsw-alias-brand-primary);color:#fff}.telosReportSettings button[data-danger]{color:var(--dsw-alias-state-error-primary)}.telosReportSettings button:disabled{cursor:not-allowed;opacity:.5}
.telosReportBanner,.telosReportEmpty{margin-bottom:14px;padding:11px 13px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55}.telosReportBanner[data-error]{color:var(--dsw-alias-state-error-primary)}
.telosReportSummary{display:flex;align-items:center;gap:18px;margin-bottom:16px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px}.telosReportSummary span{font-size:12px}.telosReportSummary strong{font-size:16px}.telosReportSummary small{min-width:0;margin-left:auto;overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.telosReportPanel{margin-top:16px;padding:18px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}.telosReportPanelHeader{margin-bottom:14px}.telosReportGrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.telosReportMailGrid{grid-template-columns:2fr .7fr 1.4fr 1fr 1.4fr 1.4fr}.telosReportPanel label{display:grid;gap:6px;color:var(--dsw-alias-label-secondary);font-size:12px}.telosReportPanel label small{color:var(--dsw-alias-label-tertiary);font-size:10px}.telosReportPanel input,.telosReportPanel textarea{box-sizing:border-box;width:100%;min-height:36px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit}.telosReportPanel textarea{resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.6}
.telosReportTabs{display:flex;gap:7px;margin-bottom:12px}.telosReportTabs button[data-active]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}.telosReportActions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.telosReportCheckbox{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center;margin-top:12px}.telosReportCheckbox input{width:auto!important;min-height:auto!important}.telosReportStatus{flex:none;padding:5px 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);font-size:10px}.telosReportStatus[data-ready]{color:var(--dsw-alias-state-success-primary)}
@media(max-width:1100px){.telosReportMailGrid{grid-template-columns:1fr 1fr}}@media(max-width:760px){.telosReportGrid,.telosReportMailGrid{grid-template-columns:1fr}.telosReportSummary{flex-wrap:wrap}.telosReportSummary small{width:100%;margin-left:0}}
`;
function installWorkReportStyles() {
  const style = document.createElement("style");
  style.dataset.telosWorkReport = "true";
  style.textContent = WORK_REPORT_CLIENT_CSS;
  document.head.append(style);
  return () => style.remove();
}

// src/client/WorkReportSettingsSection.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var REPORT_LABELS = { daily: "\u65E5\u62A5", weekly: "\u5468\u62A5", monthly: "\u6708\u62A5" };
var EMPTY_MAIL = {
  host: "",
  port: 465,
  secure: true,
  username: "",
  fromName: "",
  fromAddress: ""
};
function editableMail(config) {
  return config === void 0 ? { ...EMPTY_MAIL } : {
    host: config.host,
    port: config.port,
    secure: config.secure,
    username: config.username,
    fromName: config.fromName,
    fromAddress: config.fromAddress
  };
}
function contactLines(contacts) {
  return contacts.map((contact) => `${contact.id} | ${contact.name} | ${contact.email}`).join("\n");
}
function groupLines(groups) {
  return groups.map((group) => `${group.id} | ${group.name} | ${group.contactIds.join(", ")}`).join("\n");
}
function parseContacts(value) {
  return value.split("\n").filter((line) => line.trim() !== "").map((line, index) => {
    const fields = line.split("|").map((field) => field.trim());
    if (fields.length !== 3 || fields.some((field) => field === "")) throw new TypeError(`\u8054\u7CFB\u4EBA\u7B2C ${String(index + 1)} \u884C\u5E94\u4E3A\uFF1A\u6807\u8BC6 | \u59D3\u540D | \u90AE\u7BB1`);
    return { id: fields[0], name: fields[1], email: fields[2] };
  });
}
function parseGroups(value) {
  return value.split("\n").filter((line) => line.trim() !== "").map((line, index) => {
    const fields = line.split("|").map((field) => field.trim());
    if (fields.length !== 3 || fields[0] === "" || fields[1] === "") throw new TypeError(`\u5206\u7EC4\u7B2C ${String(index + 1)} \u884C\u5E94\u4E3A\uFF1A\u6807\u8BC6 | \u540D\u79F0 | \u8054\u7CFB\u4EBA\u6807\u8BC6\u5217\u8868`);
    return {
      id: fields[0],
      name: fields[1],
      contactIds: fields[2] === "" ? [] : fields[2].split(",").map((id) => id.trim()).filter(Boolean)
    };
  });
}
function Standards({ controller, values }) {
  const [selected, setSelected] = (0, import_react.useState)("daily");
  const [drafts, setDrafts] = (0, import_react.useState)(values);
  (0, import_react.useEffect)(() => setDrafts(values), [values]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosReportPanel", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosReportPanelHeader", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "\u62A5\u544A\u89C4\u8303" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u9996\u6B21\u751F\u6210\u524D\uFF0CAgent \u4F1A\u5728\u5BF9\u8BDD\u4E2D\u786E\u8BA4\u53D7\u4F17\u3001\u8BED\u6C14\u3001\u7BC7\u5E45\u548C\u5185\u5BB9\u8303\u56F4\u3002\u786E\u8BA4\u540E\u7684\u89C4\u8303\u4FDD\u5B58\u5728\u8FD9\u91CC\u3002" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosReportTabs", children: REPORT_TYPES.map((type) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "aria-pressed": selected === type, "data-active": selected === type || void 0, onClick: () => setSelected(type), type: "button", children: REPORT_LABELS[type] }, type)) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
      "\u5DF2\u786E\u8BA4\u7684",
      REPORT_LABELS[selected],
      "\u89C4\u8303",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { onChange: (event) => setDrafts((current) => ({ ...current, [selected]: event.target.value })), placeholder: `\u4F8B\u5982\uFF1A\u9762\u5411\u76F4\u5C5E\u4E3B\u7BA1\uFF1B\u8BED\u6C14\u7B80\u6D01\u3001\u4E8B\u5B9E\u5316\uFF1B\u63A7\u5236\u5728 500 \u5B57\u4EE5\u5185\u2026\u2026`, rows: 8, value: drafts[selected] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosReportActions", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { "data-primary": true, disabled: drafts[selected].trim() === "", onClick: () => {
      void controller.saveStandard(selected, drafts[selected]);
    }, type: "button", children: [
      "\u4FDD\u5B58",
      REPORT_LABELS[selected],
      "\u89C4\u8303"
    ] }) })
  ] });
}
var REPORT_TYPES = ["daily", "weekly", "monthly"];
function Recipients({ controller, directory }) {
  const [contacts, setContacts] = (0, import_react.useState)(contactLines(directory.contacts));
  const [groups, setGroups] = (0, import_react.useState)(groupLines(directory.groups));
  const [localError, setLocalError] = (0, import_react.useState)();
  (0, import_react.useEffect)(() => {
    setContacts(contactLines(directory.contacts));
    setGroups(groupLines(directory.groups));
  }, [directory]);
  const save = () => {
    try {
      setLocalError(void 0);
      void controller.saveDirectory({ version: 1, contacts: parseContacts(contacts), groups: parseGroups(groups) });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosReportPanel", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosReportPanelHeader", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "\u8054\u7CFB\u4EBA\u4E0E\u5206\u7EC4" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u90AE\u4EF6\u53D1\u9001\u65F6\u6309\u6807\u8BC6\u9009\u62E9\u8054\u7CFB\u4EBA\u6216\u5206\u7EC4\uFF1B\u5BA1\u6279\u7A97\u53E3\u4F1A\u5C55\u793A\u5C55\u5F00\u540E\u7684\u771F\u5B9E\u6536\u4EF6\u4EBA\u3002" })
    ] }) }),
    localError === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosReportBanner", "data-error": true, children: localError }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosReportGrid", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "\u8054\u7CFB\u4EBA\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF09",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { onChange: (event) => setContacts(event.target.value), placeholder: "manager | \u76F4\u5C5E\u4E3B\u7BA1 | manager@example.com", rows: 7, value: contacts }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "\u683C\u5F0F\uFF1A\u6807\u8BC6 | \u59D3\u540D | \u90AE\u7BB1" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "\u5206\u7EC4\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF09",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { onChange: (event) => setGroups(event.target.value), placeholder: "weekly-review | \u5468\u62A5\u6536\u4EF6\u7EC4 | manager, teammate", rows: 7, value: groups }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "\u683C\u5F0F\uFF1A\u6807\u8BC6 | \u540D\u79F0 | \u8054\u7CFB\u4EBA\u6807\u8BC6\uFF0C\u7528\u82F1\u6587\u9017\u53F7\u5206\u9694" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosReportActions", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "data-primary": true, onClick: save, type: "button", children: "\u4FDD\u5B58\u8054\u7CFB\u4EBA\u4E0E\u5206\u7EC4" }) })
  ] });
}
function Mail({ controller, configured }) {
  const [mail, setMail] = (0, import_react.useState)(() => editableMail(configured));
  const [password, setPassword] = (0, import_react.useState)("");
  (0, import_react.useEffect)(() => setMail(editableMail(configured)), [configured]);
  const update = (patch) => setMail((current) => ({ ...current, ...patch }));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosReportPanel", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosReportPanelHeader", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "\u90AE\u4EF6\u53D1\u9001" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u90AE\u4EF6\u7531\u672C\u673A SMTP \u76F4\u63A5\u53D1\u9001\u3002\u5BC6\u7801\u4EA4\u7ED9 DSH \u51ED\u636E\u5B58\u50A8\uFF0C\u62A5\u544A\u914D\u7F6E\u6587\u4EF6\u4E2D\u53EA\u4FDD\u5B58\u975E\u654F\u611F\u8FDE\u63A5\u4FE1\u606F\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telosReportStatus", "data-ready": configured?.passwordConfigured || void 0, children: configured?.passwordConfigured ? `\u5BC6\u7801\u5DF2\u914D\u7F6E${configured.passwordSource === void 0 ? "" : ` \xB7 ${configured.passwordSource}`}` : "\u5BC6\u7801\u672A\u914D\u7F6E" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosReportGrid telosReportMailGrid", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "SMTP \u4E3B\u673A",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { onChange: (event) => update({ host: event.target.value }), placeholder: "smtp.example.com", value: mail.host })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "\u7AEF\u53E3",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { min: "1", max: "65535", onChange: (event) => update({ port: Number(event.target.value) }), type: "number", value: mail.port })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "\u7528\u6237\u540D",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { onChange: (event) => update({ username: event.target.value }), placeholder: "sender@example.com", value: mail.username })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "\u53D1\u4EF6\u4EBA\u540D\u79F0",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { onChange: (event) => update({ fromName: event.target.value }), placeholder: "\u5C0F\u53EF", value: mail.fromName })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "\u53D1\u4EF6\u90AE\u7BB1",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { onChange: (event) => update({ fromAddress: event.target.value }), placeholder: "sender@example.com", value: mail.fromAddress })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "SMTP \u5BC6\u7801",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { autoComplete: "new-password", onChange: (event) => setPassword(event.target.value), placeholder: configured?.passwordConfigured ? "\u7559\u7A7A\u5219\u4FDD\u6301\u73B0\u6709\u5BC6\u7801" : "\u8F93\u5165\u5BC6\u7801\u6216\u5E94\u7528\u4E13\u7528\u5BC6\u7801", type: "password", value: password })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "telosReportCheckbox", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { checked: mail.secure, onChange: (event) => update({ secure: event.target.checked }), type: "checkbox" }),
      "\u4F7F\u7528 TLS \u76F4\u8FDE\uFF08\u5E38\u7528\u4E8E 465 \u7AEF\u53E3\uFF09"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosReportActions", children: [
      configured?.passwordConfigured && configured.passwordWritable !== false ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "data-danger": true, onClick: () => {
        setPassword("");
        void controller.saveMail(mail, null);
      }, type: "button", children: "\u6E05\u9664\u5DF2\u4FDD\u5B58\u5BC6\u7801" }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "data-primary": true, onClick: () => {
        void controller.saveMail(mail, password.trim() === "" ? void 0 : password);
        setPassword("");
      }, type: "button", children: "\u4FDD\u5B58\u90AE\u4EF6\u914D\u7F6E" })
    ] })
  ] });
}
function WorkReportSettingsSection({ controller }) {
  const state = (0, import_react.useSyncExternalStore)(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  (0, import_react.useEffect)(() => {
    void controller.refresh();
  }, [controller]);
  const settings = state.settings;
  const reportSummary = (0, import_react.useMemo)(() => {
    const counts = { daily: 0, weekly: 0, monthly: 0 };
    for (const report of state.reports) counts[report.type] += 1;
    return counts;
  }, [state.reports]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { "aria-label": "\u5DE5\u4F5C\u62A5\u544A\u8BBE\u7F6E", className: "telosReportSettings", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "telosReportHeader", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "\u5DE5\u4F5C\u62A5\u544A" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u901A\u8FC7\u81EA\u7136\u5BF9\u8BDD\u751F\u6210\u65E5\u62A5\uFF0C\u5E76\u4ECE\u672C\u5730\u5DF2\u6709\u62A5\u544A\u6C47\u603B\u5468\u62A5\u548C\u6708\u62A5\u3002\u62A5\u544A\u6B63\u6587\u59CB\u7EC8\u662F\u666E\u901A Markdown \u6587\u4EF6\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: state.loading, onClick: () => {
        void controller.refresh();
      }, type: "button", children: "\u5237\u65B0" })
    ] }),
    state.error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosReportBanner", "data-error": true, children: state.error }),
    state.notice === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosReportBanner", children: state.notice }),
    settings === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosReportEmpty", children: state.loading ? "\u6B63\u5728\u8BFB\u53D6\u672C\u5730\u914D\u7F6E\u2026" : "\u5C1A\u672A\u8BFB\u53D6\u5230\u5DE5\u4F5C\u62A5\u544A\u914D\u7F6E\u3002" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosReportSummary", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: reportSummary.daily }),
          " \u7BC7\u65E5\u62A5"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: reportSummary.weekly }),
          " \u7BC7\u5468\u62A5"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: reportSummary.monthly }),
          " \u7BC7\u6708\u62A5"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "\u62A5\u544A\u548C\u914D\u7F6E\u5168\u90E8\u4FDD\u5B58\u5728\u672C\u673A" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Standards, { controller, values: settings.standards }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Recipients, { controller, directory: settings.directory }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mail, { controller, configured: settings.mail })
    ] })
  ] });
}

// src/client/index.ts
var inject = ["slots", "connection"];
function apply(ctx) {
  const controller = new WorkReportClientController(ctx.connection.rpc);
  const injected = () => ({ controller });
  ctx.effect(() => installWorkReportStyles(), "telos-work-report: client styles");
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "work-report",
    order: 28,
    label: "\u5DE5\u4F5C\u62A5\u544A",
    inject: injected
  }, WorkReportSettingsSection));
}

    return module.exports;
  },
});
