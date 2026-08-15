window.__ModuleLoader__.load({
  id: "@telos/dsh-continuity",
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
  ContinuityClientController: () => ContinuityClientController,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/ContinuityViews.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function MemoryIcon({ size = 18 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { "aria-hidden": "true", fill: "none", height: size, viewBox: "0 0 24 24", width: size, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8.5 4.5a3 3 0 0 0-3 3v1a3.5 3.5 0 0 0 0 7v1a3 3 0 0 0 5.5 1.65V5.85A3 3 0 0 0 8.5 4.5Z", stroke: "currentColor", strokeWidth: "1.7" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M15.5 4.5a3 3 0 0 1 3 3v1a3.5 3.5 0 0 1 0 7v1a3 3 0 0 1-5.5 1.65V5.85a3 3 0 0 1 2.5-1.35Z", stroke: "currentColor", strokeWidth: "1.7" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 9.5h3M13 14.5h3", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.7" })
  ] });
}
function CloseIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { "aria-hidden": "true", fill: "none", height: "18", viewBox: "0 0 20 20", width: "18", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m5 5 10 10M15 5 5 15", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.6" }) });
}
function RefreshIcon({ spinning }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { "aria-hidden": "true", className: spinning ? "telosContinuitySpinner" : void 0, fill: "none", height: "17", viewBox: "0 0 20 20", width: "17", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M15.3 6.7A6 6 0 1 0 16 12", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.6" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12.5 6.7h2.8V3.9", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "1.6" })
  ] });
}
function useContinuity(controller) {
  return (0, import_react.useSyncExternalStore)(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}
function formatDate(value) {
  if (value === void 0) return "\u2014";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(void 0, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
function scopeLabel(scope) {
  if (scope.type === "global") return "\u5168\u5C40";
  return `${scope.type === "workspace" ? "\u5DE5\u4F5C\u533A" : "\u4F1A\u8BDD"} \xB7 ${scope.id.slice(0, 10)}`;
}
function statusLabel(status) {
  return {
    candidate: "\u5F85\u786E\u8BA4",
    confirmed: "\u5DF2\u786E\u8BA4",
    superseded: "\u5DF2\u7EA0\u6B63",
    contradicted: "\u6709\u51B2\u7A81",
    revoked: "\u5DF2\u64A4\u9500",
    expired: "\u5DF2\u8FC7\u671F"
  }[status];
}
function kindLabel(kind) {
  return {
    semantic: "\u4E8B\u5B9E",
    episodic: "\u4E8B\u4EF6",
    procedural: "\u65B9\u6CD5",
    prospective: "\u627F\u8BFA",
    constraint: "\u7EA6\u675F"
  }[kind];
}
function ContinuityFooterAction({ controller, wide }) {
  const state = useContinuity(controller);
  const activeCount = state.claims.filter((claim) => claim.status === "confirmed").length;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "button",
    {
      "aria-label": "\u6253\u5F00\u8FDE\u7EED\u8BB0\u5FC6",
      className: "telosContinuityFooterButton",
      "data-rail": wide ? void 0 : "",
      onClick: () => controller.open(),
      title: "\u8FDE\u7EED\u8BB0\u5FC6",
      type: "button",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MemoryIcon, {}),
        wide ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          "\u8FDE\u7EED\u8BB0\u5FC6",
          activeCount > 0 ? ` \xB7 ${String(activeCount)}` : ""
        ] }) : null
      ]
    }
  );
}
function ContinuityHeaderAction({
  controller,
  sessionId
}) {
  const state = useContinuity(controller);
  const receipt = state.sessionReceipts[sessionId] ?? { selectedCount: 0 };
  (0, import_react.useEffect)(() => {
    void controller.loadSessionReceipt(sessionId);
    const timer = window.setInterval(() => {
      void controller.loadSessionReceipt(sessionId);
    }, 15e3);
    return () => window.clearInterval(timer);
  }, [controller, sessionId]);
  const label = receipt.selectedCount > 0 ? `\u8BB0\u5FC6 \xB7 ${String(receipt.selectedCount)}` : "\u8BB0\u5FC6";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "button",
    {
      "aria-label": receipt.selectedCount > 0 ? `\u672C\u8F6E\u53EC\u56DE ${String(receipt.selectedCount)} \u6761\u8BB0\u5FC6` : "\u6253\u5F00\u8FDE\u7EED\u8BB0\u5FC6",
      className: "telosContinuityHeaderButton",
      onClick: () => controller.open(sessionId),
      title: receipt.createdAt === void 0 ? "\u8FDE\u7EED\u8BB0\u5FC6" : `\u6700\u8FD1\u4F7F\u7528\u4E8E ${formatDate(receipt.createdAt)}`,
      type: "button",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MemoryIcon, { size: 15 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }),
        receipt.selectedCount > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telosContinuityBadge", children: receipt.selectedCount }) : null
      ]
    }
  );
}
var TABS = [
  { id: "memories", label: "\u8BB0\u5FC6" },
  { id: "graph", label: "\u5173\u7CFB\u56FE" },
  { id: "recalls", label: "\u53EC\u56DE\u56DE\u6267" },
  { id: "audit", label: "\u884C\u52A8\u4E0E\u5220\u9664" }
];
function filteredClaims(state) {
  const query = state.query.trim().toLocaleLowerCase();
  return state.claims.filter((claim) => {
    const statusMatch = state.statusFilter === "all" || state.statusFilter === "active" && ["confirmed", "candidate", "contradicted"].includes(claim.status) || claim.status === state.statusFilter;
    const queryMatch = query.length === 0 || `${claim.statement} ${claim.predicate} ${claim.objectValue ?? ""}`.toLocaleLowerCase().includes(query);
    return statusMatch && queryMatch;
  });
}
function ClaimList({ controller, state }) {
  const claims = filteredClaims(state);
  const filters = [
    ["active", "\u6709\u6548"],
    ["all", "\u5168\u90E8"],
    ["candidate", "\u5F85\u786E\u8BA4"],
    ["revoked", "\u5DF2\u64A4\u9500"],
    ["superseded", "\u5386\u53F2"]
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosContinuityListPane", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosContinuityFilters", children: filters.map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        className: "telosContinuityFilter",
        "data-active": state.statusFilter === id ? "" : void 0,
        onClick: () => controller.setStatusFilter(id),
        type: "button",
        children: label
      },
      id
    )) }),
    claims.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosContinuityEmpty", children: "\u6CA1\u6709\u5339\u914D\u7684\u8BB0\u5FC6\u3002\u660E\u786E\u544A\u8BC9 Telos\u201C\u8BB0\u4F4F\u2026\u2026\u201D\u5373\u53EF\u5EFA\u7ACB\u7B2C\u4E00\u6761\u3002" }) : claims.map((claim) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "button",
      {
        className: "telosContinuityClaim",
        "data-selected": state.selectedClaimId === claim.id ? "" : void 0,
        onClick: () => {
          void controller.selectClaim(claim.id);
        },
        type: "button",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosContinuityClaimMeta", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telosContinuityChip", "data-status": claim.status, children: statusLabel(claim.status) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telosContinuityChip", children: kindLabel(claim.kind) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telosContinuityChip", children: scopeLabel(claim.scope) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "telosContinuityClaimStatement", children: claim.statement }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "telosContinuityMuted", children: [
            formatDate(claim.recordedAt),
            " \xB7 ",
            claim.sourceEpisodeIds.length,
            " \u4E2A\u6765\u6E90"
          ] })
        ]
      },
      claim.id
    ))
  ] });
}
function SourceCard({ source }) {
  if (source === void 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosContinuitySource telosContinuityMuted", children: "\u6B63\u5728\u8BFB\u53D6\u6765\u6E90\u2026" });
  if (source === null) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosContinuitySource telosContinuityMuted", children: "\u6765\u6E90\u5DF2\u4E0D\u53EF\u7528" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosContinuitySource", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosContinuityMetaRow", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telosContinuityChip", children: source.sourceKind }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telosContinuityChip", children: source.deletionState === "purged" ? "\u5185\u5BB9\u5DF2\u6E05\u9664" : "\u6765\u6E90\u4FDD\u7559" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telosContinuityMuted", children: formatDate(source.observedAt) })
    ] }),
    source.content === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { className: "telosContinuitySourceContent", children: source.content }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosContinuityMuted", title: source.contentHash, children: [
      "hash \xB7 ",
      source.contentHash.slice(0, 12)
    ] })
  ] });
}
function ClaimDetail({ controller, state, claim }) {
  const [statement, setStatement] = (0, import_react.useState)(claim.statement);
  const [predicate, setPredicate] = (0, import_react.useState)(claim.predicate);
  const [value, setValue] = (0, import_react.useState)(claim.objectValue ?? claim.objectEntityId ?? "");
  const [armedPhysical, setArmedPhysical] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    setStatement(claim.statement);
    setPredicate(claim.predicate);
    setValue(claim.objectValue ?? claim.objectEntityId ?? "");
    setArmedPhysical(false);
  }, [claim]);
  const editable = claim.status === "confirmed" || claim.status === "candidate" || claim.status === "contradicted";
  const recalls = state.recalls.filter((recall) => recall.selectedClaims.some((selected) => selected.id === claim.id));
  const materializations = state.materializations.filter((item) => item.claimId === claim.id);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosContinuityDetailPane", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: "telosContinuityDetailTitle", children: claim.statement }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosContinuityMetaRow", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telosContinuityChip", "data-status": claim.status, children: statusLabel(claim.status) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telosContinuityChip", children: kindLabel(claim.kind) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telosContinuityChip", children: claim.sensitivity }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telosContinuityChip", children: scopeLabel(claim.scope) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", { className: "telosContinuityDefinition", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "\u5173\u7CFB" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: claim.predicate }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "\u503C" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: claim.objectValue ?? claim.objectEntityId ?? "\u2014" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "\u53EF\u4FE1\u5EA6" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", { children: [
        Math.round(claim.confidence * 100),
        "%"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "\u7248\u672C" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", { children: [
        "r",
        claim.revision,
        claim.supersedesClaimId === void 0 ? "" : ` \xB7 \u7EA0\u6B63 ${claim.supersedesClaimId.slice(0, 12)}`
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "\u5B9E\u9645\u4F7F\u7528" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", { children: [
        recalls.length,
        " \u6B21\u53EC\u56DE \xB7 ",
        materializations.length,
        " \u4E2A\u4F1A\u8BDD\u526F\u672C"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "\u5185\u5BB9\u6307\u7EB9" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", { title: claim.contentHash, children: [
        claim.contentHash.slice(0, 20),
        "\u2026"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "telosContinuitySection", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "telosContinuitySectionTitle", children: "\u8BC1\u636E\u6765\u6E90" }),
      claim.sourceEpisodeIds.map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceCard, { source: state.sourcesById[id] }, id))
    ] }),
    claim.status === "candidate" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "telosContinuitySection", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "telosContinuitySectionTitle", children: "\u5019\u9009\u8BB0\u5FC6" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "telosContinuityMuted", children: "\u8FD9\u662F\u4ECE\u4F60\u7684\u76F4\u63A5\u9648\u8FF0\u4E2D\u63D0\u53D6\u7684\u5019\u9009\u9879\u3002\u786E\u8BA4\u524D\u4E0D\u4F1A\u8FDB\u5165\u6B63\u5E38\u53EC\u56DE\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          className: "telosContinuityButton",
          "data-primary": true,
          disabled: state.loading,
          onClick: () => {
            void controller.confirm(claim);
          },
          type: "button",
          children: "\u786E\u8BA4\u8FD9\u6761\u5019\u9009\u8BB0\u5FC6"
        }
      )
    ] }) : null,
    editable ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "telosContinuitySection", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "telosContinuitySectionTitle", children: "\u7EA0\u6B63\uFF0C\u4E0D\u8986\u76D6\u5386\u53F2" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosContinuityEditGrid", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { "aria-label": "\u8BB0\u5FC6\u8868\u8FF0", className: "telosContinuityField", onChange: (event) => setStatement(event.target.value), rows: 2, value: statement }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { "aria-label": "\u5173\u7CFB", className: "telosContinuityField", onChange: (event) => setPredicate(event.target.value), value: predicate }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { "aria-label": "\u503C", className: "telosContinuityField", onChange: (event) => setValue(event.target.value), value })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosContinuityActions", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          className: "telosContinuityButton",
          "data-primary": true,
          disabled: state.loading || statement.trim() === "" || predicate.trim() === "" || value.trim() === "",
          onClick: () => {
            void controller.correct(claim, { statement, predicate, objectValue: value });
          },
          type: "button",
          children: "\u4FDD\u5B58\u4E3A\u65B0\u7248\u672C"
        }
      ) })
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "telosContinuitySection", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "telosContinuitySectionTitle", children: "\u64A4\u9500\u4E0E\u672C\u5730\u5220\u9664" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "telosContinuityMuted", children: "\u64A4\u9500\u4F1A\u4FDD\u7559\u5BA1\u8BA1\u5386\u53F2\u4F46\u505C\u6B62\u53EC\u56DE\uFF1B\u5F7B\u5E95\u5220\u9664\u4F1A\u6E05\u9664\u672C\u5730 Claim \u548C\u65E0\u5171\u4EAB\u6765\u6E90\u5185\u5BB9\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosContinuityActions", children: [
        claim.status === "revoked" ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            className: "telosContinuityButton",
            "data-danger": true,
            disabled: state.loading,
            onClick: () => {
              void controller.forget(claim, false);
            },
            type: "button",
            children: "\u64A4\u9500\u8BB0\u5FC6"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            className: "telosContinuityButton",
            "data-danger": true,
            disabled: state.loading,
            onClick: () => {
              if (!armedPhysical) setArmedPhysical(true);
              else void controller.forget(claim, true);
            },
            type: "button",
            children: armedPhysical ? "\u518D\u6B21\u70B9\u51FB\u786E\u8BA4\u5F7B\u5E95\u5220\u9664" : "\u5F7B\u5E95\u5220\u9664\u672C\u5730\u8BB0\u5F55"
          }
        )
      ] })
    ] })
  ] });
}
function MemoriesView({ controller, state }) {
  const selected = state.claims.find((claim) => claim.id === state.selectedClaimId);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosContinuityMemoryGrid", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClaimList, { controller, state }),
    selected === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosContinuityEmpty", children: "\u9009\u62E9\u4E00\u6761\u8BB0\u5FC6\uFF0C\u67E5\u770B\u6765\u6E90\u3001\u7248\u672C\u548C\u5B9E\u9645\u53EC\u56DE\u8BB0\u5F55\u3002" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClaimDetail, { claim: selected, controller, state })
  ] });
}
function GraphView({ state }) {
  const entities = new Map(state.entities.map((entity) => [entity.id, entity.canonicalName]));
  const relations = state.relations.filter((relation) => state.query.trim() === "" || `${relation.predicate} ${relation.objectValue ?? ""} ${entities.get(relation.fromEntityId) ?? ""}`.toLocaleLowerCase().includes(state.query.trim().toLocaleLowerCase()));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosContinuityScrollPane telosContinuityContent", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: "telosContinuityContentTitle", children: "\u5B9E\u4F53\u5173\u7CFB\u6295\u5F71" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "telosContinuityContentSubtitle", children: "\u6BCF\u6761\u8FB9\u90FD\u80FD\u56DE\u5230 MemoryClaim\uFF1B\u56FE\u53EF\u91CD\u5EFA\uFF0C\u4E0D\u662F\u552F\u4E00\u4E8B\u5B9E\u6E90\u3002" }),
    relations.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosContinuityEmpty", children: "\u8FD8\u6CA1\u6709\u53EF\u5C55\u793A\u7684\u5173\u7CFB\u3002" }) : relations.map((relation) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosContinuityGraphRow", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosContinuityNode", children: entities.get(relation.fromEntityId) ?? relation.fromEntityId }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosContinuityEdge", children: relation.predicate }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosContinuityNode", children: relation.toEntityId === void 0 ? relation.objectValue : entities.get(relation.toEntityId) ?? relation.toEntityId })
    ] }, relation.claimId))
  ] });
}
function RecallCard({ recall, state }) {
  const materialized = state.materializations.filter((item) => item.recallId === recall.id);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { className: "telosContinuityReceipt", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosContinuityReceiptHeader", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "telosContinuityChip", children: [
        "\u9009\u4E2D ",
        recall.selectedClaims.length
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "telosContinuityChip", children: [
        "\u5019\u9009 ",
        recall.candidates.length
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "telosContinuityChip", children: [
        "\u6CE8\u5165 ",
        materialized.length
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "telosContinuityMuted", children: [
        formatDate(recall.createdAt),
        " \xB7 ",
        recall.latencyMs.toFixed(1),
        " ms"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "telosContinuityReceiptQuery", children: recall.query }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "telosContinuityReceiptClaims", children: recall.selectedClaims.length === 0 ? "\u672A\u4F7F\u7528\u4EFB\u4F55\u8BB0\u5FC6" : recall.selectedClaims.map((claim) => `${claim.id.slice(0, 10)} \xB7 ${claim.statement}`).join("\uFF1B") }),
    recall.contradictionSets.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "telosContinuityReceiptClaims", children: [
      "\u5B58\u5728 ",
      recall.contradictionSets.length,
      " \u7EC4\u672A\u89E3\u51B3\u51B2\u7A81\uFF0C\u5747\u4FDD\u7559\u5728\u56DE\u6267\u4E2D\u3002"
    ] }) : null
  ] });
}
function RecallsView({ state }) {
  const query = state.query.trim().toLocaleLowerCase();
  const recalls = state.recalls.filter((recall) => query.length === 0 || recall.query.toLocaleLowerCase().includes(query) || recall.selectedClaims.some((claim) => claim.statement.toLocaleLowerCase().includes(query)));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosContinuityScrollPane telosContinuityContent", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: "telosContinuityContentTitle", children: "\u53EC\u56DE\u51B3\u7B56\u56DE\u6267" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "telosContinuityContentSubtitle", children: "\u80FD\u770B\u5230\u9009\u4E86\u4EC0\u4E48\u3001\u5FFD\u7565\u4E86\u4EC0\u4E48\u3001\u662F\u5426\u771F\u7684\u6CE8\u5165\u67D0\u4E2A DSH \u4F1A\u8BDD\u3002" }),
    recalls.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosContinuityEmpty", children: "\u5C1A\u65E0\u53EC\u56DE\u8BB0\u5F55\u3002" }) : recalls.map((recall) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecallCard, { recall, state }, recall.id))
  ] });
}
function AuditView({ state }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosContinuityScrollPane telosContinuityContent", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: "telosContinuityContentTitle", children: "\u884C\u52A8\u4E0E\u5220\u9664\u5BA1\u8BA1" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "telosContinuityContentSubtitle", children: "\u884C\u52A8\u56DE\u6267\u4E0D\u4FDD\u5B58\u539F\u59CB\u53C2\u6570\uFF1B\u5220\u9664\u56DE\u6267\u660E\u786E\u5217\u51FA\u4ECD\u5B58\u5728\u4E8E\u4F1A\u8BDD\u4E2D\u7684\u6D3E\u751F\u526F\u672C\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosContinuityAuditGrid", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "telosContinuityAuditColumn", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "telosContinuitySectionTitle", children: "\u884C\u52A8\u56DE\u6267" }),
        state.receipts.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosContinuityEmpty", children: "\u6682\u65E0\u884C\u52A8\u56DE\u6267\u3002" }) : state.receipts.map((receipt) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { className: "telosContinuityReceipt", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosContinuityReceiptHeader", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telosContinuityChip", children: receipt.result }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telosContinuityChip", children: receipt.authorization }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telosContinuityMuted", children: formatDate(receipt.occurredAt) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "telosContinuityReceiptQuery", children: receipt.action }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "telosContinuityReceiptClaims", children: [
            receipt.runtimeId,
            " \xB7 ",
            scopeLabel(receipt.scope)
          ] })
        ] }, receipt.id))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "telosContinuityAuditColumn", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "telosContinuitySectionTitle", children: "\u5220\u9664\u56DE\u6267" }),
        state.deletions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosContinuityEmpty", children: "\u6682\u65E0\u5220\u9664\u8BB0\u5F55\u3002" }) : state.deletions.map((report) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { className: "telosContinuityReceipt", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosContinuityReceiptHeader", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telosContinuityChip", children: report.physicallyPurged ? "\u5DF2\u5F7B\u5E95\u5220\u9664" : "\u5DF2\u64A4\u9500" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "telosContinuityMuted", children: formatDate(report.completedAt) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "telosContinuityReceiptQuery", children: report.claimId }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "telosContinuityReceiptClaims", children: [
            "\u6765\u6E90 ",
            report.sourceStates.length,
            " \xB7 \u5F85\u5904\u7406\u4F1A\u8BDD\u526F\u672C ",
            report.derivatives.length
          ] })
        ] }, report.receiptId))
      ] })
    ] })
  ] });
}
function ContinuityOverlay({ controller }) {
  const state = useContinuity(controller);
  (0, import_react.useEffect)(() => {
    if (!state.open) return;
    const close = (event) => {
      if (event.key === "Escape") controller.close();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [controller, state.open]);
  if (!state.open) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      className: "telosContinuityBackdrop",
      onMouseDown: (event) => {
        if (event.currentTarget === event.target) controller.close();
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { "aria-label": "\u8FDE\u7EED\u8BB0\u5FC6", "aria-modal": "true", className: "telosContinuityDialog", role: "dialog", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "telosContinuityTopbar", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "telosContinuityTitleBlock", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { className: "telosContinuityTitle", children: "\u8FDE\u7EED\u8BB0\u5FC6" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "telosContinuitySubtitle", children: "\u53EF\u89C1\u3001\u53EF\u7EA0\u6B63\u3001\u53EF\u5220\u9664\u3001\u53EF\u8FFD\u6EAF" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              "aria-label": "\u641C\u7D22\u8BB0\u5FC6",
              autoFocus: true,
              className: "telosContinuitySearch",
              onChange: (event) => controller.setQuery(event.target.value),
              placeholder: "\u641C\u7D22\u8868\u8FF0\u3001\u5173\u7CFB\u6216\u503C",
              value: state.query
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "aria-label": "\u5237\u65B0", className: "telosContinuityIconButton", onClick: () => {
            void controller.refresh();
          }, type: "button", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshIcon, { spinning: state.loading }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "aria-label": "\u5173\u95ED\u8FDE\u7EED\u8BB0\u5FC6", className: "telosContinuityIconButton", onClick: () => controller.close(), type: "button", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloseIcon, {}) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", { "aria-label": "\u8FDE\u7EED\u8BB0\u5FC6\u89C6\u56FE", className: "telosContinuityTabs", role: "tablist", children: [
            TABS.map((tab) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                "aria-selected": state.tab === tab.id,
                className: "telosContinuityTab",
                onClick: () => controller.setTab(tab.id),
                role: "tab",
                type: "button",
                children: tab.label
              },
              tab.id
            )),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "telosContinuityHealth", title: state.health?.databasePath, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "span",
                {
                  className: "telosContinuityHealthDot",
                  "data-health": state.health === void 0 ? "loading" : state.health.integrity === "ok" && state.health.lastBackgroundError === void 0 ? "ok" : "error"
                }
              ),
              state.health === void 0 ? "\u6B63\u5728\u8FDE\u63A5" : state.health.lastBackgroundError === void 0 ? `\u672C\u5730\u6570\u636E\u5E93 \xB7 schema ${String(state.health.schemaVersion)}` : `\u540E\u53F0\u9519\u8BEF \xB7 ${state.health.lastBackgroundError}`
            ] })
          ] }),
          state.error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosContinuityBanner", "data-error": true, children: state.error }),
          state.notice === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "telosContinuityBanner", children: state.notice })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { className: "telosContinuityBody", children: [
          state.tab === "memories" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MemoriesView, { controller, state }) : null,
          state.tab === "graph" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GraphView, { state }) : null,
          state.tab === "recalls" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecallsView, { state }) : null,
          state.tab === "audit" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuditView, { state }) : null
        ] })
      ] })
    }
  );
}

// src/contracts.ts
var CONTINUITY_RPC_CHANNEL = "/telos-continuity";

// src/client/controller.ts
var EMPTY_SNAPSHOT = {
  open: false,
  tab: "memories",
  loading: false,
  claims: [],
  entities: [],
  relations: [],
  recalls: [],
  materializations: [],
  receipts: [],
  deletions: [],
  sourcesById: {},
  query: "",
  statusFilter: "active",
  sessionReceipts: {}
};
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}
function randomId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function managementSource(statement, sensitivity) {
  const id = randomId();
  return {
    sourceKind: "telos.user-edit",
    runtimeId: "dsh-web",
    sourceInstanceId: `memory-edit:${id}`,
    observedAt: (/* @__PURE__ */ new Date()).toISOString(),
    content: statement,
    sensitivity
  };
}
function confirmationSource(claim) {
  const id = randomId();
  return {
    sourceKind: "telos.user-confirmation",
    runtimeId: "dsh-web",
    sourceInstanceId: `memory-confirmation:${id}`,
    observedAt: (/* @__PURE__ */ new Date()).toISOString(),
    content: `Confirmed candidate: ${claim.statement}`,
    sensitivity: claim.sensitivity
  };
}
var ContinuityClientController = class {
  constructor(rpc) {
    this.rpc = rpc;
  }
  snapshot = EMPTY_SNAPSHOT;
  listeners = /* @__PURE__ */ new Set();
  receiptLoads = /* @__PURE__ */ new Map();
  getSnapshot = () => this.snapshot;
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  open(sessionId) {
    this.update({ open: true, activeSessionId: sessionId, error: void 0, notice: void 0 });
    void this.refresh();
  }
  close() {
    this.update({ open: false, error: void 0, notice: void 0 });
  }
  setTab(tab) {
    this.update({ tab });
  }
  setQuery(query) {
    this.update({ query });
  }
  setStatusFilter(statusFilter) {
    this.update({ statusFilter });
  }
  async selectClaim(claimId) {
    this.update({ selectedClaimId: claimId, error: void 0, notice: void 0 });
    if (claimId === void 0) return;
    const claim = this.snapshot.claims.find((candidate) => candidate.id === claimId);
    if (claim === void 0) return;
    const missing = claim.sourceEpisodeIds.filter((id) => !(id in this.snapshot.sourcesById));
    if (missing.length === 0) return;
    try {
      const sources = await Promise.all(missing.map((id) => this.request("source/get", {
        sourceEpisodeId: id
      })));
      const additions = Object.fromEntries(missing.map((id, index) => [id, sources[index] ?? null]));
      this.update({ sourcesById: { ...this.snapshot.sourcesById, ...additions } });
    } catch (error) {
      this.update({ error: messageOf(error) });
    }
  }
  async refresh() {
    this.update({ loading: true, error: void 0 });
    try {
      const [health, claims, entities, relations, recalls, materializations, receipts, deletions] = await Promise.all([
        this.request("health", {}),
        this.request("memory/list", { limit: 500 }),
        this.request("entity/list", { limit: 500 }),
        this.request("graph/list", { limit: 1e3 }),
        this.request("recall/list", { limit: 100 }),
        this.request("materialization/list", { limit: 500 }),
        this.request("receipt/list", { limit: 200 }),
        this.request("deletion/list", {})
      ]);
      this.update({
        loading: false,
        health,
        claims,
        entities,
        relations,
        recalls,
        materializations,
        receipts,
        deletions
      });
      const selected = this.snapshot.selectedClaimId;
      if (selected !== void 0 && !claims.some((claim) => claim.id === selected)) {
        this.update({ selectedClaimId: void 0 });
      }
    } catch (error) {
      this.update({ loading: false, error: messageOf(error) });
    }
  }
  async correct(claim, draft) {
    this.update({ loading: true, error: void 0, notice: void 0 });
    try {
      const replacement = await this.request("memory/correct", {
        claimId: claim.id,
        statement: draft.statement,
        predicate: draft.predicate,
        objectValue: draft.objectValue,
        kind: claim.kind,
        scope: claim.scope,
        sensitivity: claim.sensitivity,
        confidence: 1,
        importance: claim.importance,
        status: "confirmed",
        source: managementSource(draft.statement, claim.sensitivity),
        actor: "user",
        idempotencyKey: `ui:correct:${randomId()}`,
        validFrom: claim.validFrom,
        validTo: claim.validTo
      });
      this.update({ selectedClaimId: replacement.id, notice: "\u5DF2\u4FDD\u7559\u539F\u8BB0\u5F55\uFF0C\u5E76\u521B\u5EFA\u7EA0\u6B63\u540E\u7684\u65B0\u7248\u672C\u3002" });
      await this.refresh();
      await this.selectClaim(replacement.id);
    } catch (error) {
      this.update({ loading: false, error: messageOf(error) });
    }
  }
  async confirm(claim) {
    this.update({ loading: true, error: void 0, notice: void 0 });
    try {
      const confirmed = await this.request("memory/confirm", {
        claimId: claim.id,
        source: confirmationSource(claim),
        actor: "user",
        idempotencyKey: `ui:confirm:${randomId()}`
      });
      this.update({ selectedClaimId: confirmed.id, notice: "\u5019\u9009\u8BB0\u5FC6\u5DF2\u7531\u4F60\u786E\u8BA4\uFF0C\u4E4B\u540E\u53EF\u4EE5\u53C2\u4E0E\u6B63\u5E38\u53EC\u56DE\u3002" });
      await this.refresh();
      await this.selectClaim(confirmed.id);
    } catch (error) {
      this.update({ loading: false, error: messageOf(error) });
    }
  }
  async forget(claim, physical) {
    this.update({ loading: true, error: void 0, notice: void 0 });
    try {
      const report = await this.request("memory/forget", {
        claimId: claim.id,
        physical,
        purgeSourceContent: physical,
        actor: "user",
        idempotencyKey: `ui:forget:${randomId()}`
      });
      this.update({
        selectedClaimId: physical ? void 0 : claim.id,
        notice: physical ? `\u5DF2\u5F7B\u5E95\u5220\u9664\uFF1B${String(report.derivatives.length)} \u5904\u5DF2\u4F7F\u7528\u526F\u672C\u9700\u5728\u5BF9\u5E94\u4F1A\u8BDD\u4E2D\u7EE7\u7EED\u5220\u9664\u3002` : "\u5DF2\u64A4\u9500\u8BE5\u8BB0\u5FC6\uFF1B\u5B83\u4E0D\u4F1A\u518D\u53C2\u4E0E\u53EC\u56DE\u3002"
      });
      await this.refresh();
      return report;
    } catch (error) {
      this.update({ loading: false, error: messageOf(error) });
      return void 0;
    }
  }
  sessionReceipt(sessionId) {
    return this.snapshot.sessionReceipts[sessionId] ?? { selectedCount: 0 };
  }
  loadSessionReceipt(sessionId) {
    const existing = this.receiptLoads.get(sessionId);
    if (existing !== void 0) return existing;
    const pending = this.request("recall/list", { sessionId, limit: 1 }).then((recalls) => {
      const latest = recalls[0];
      this.update({
        sessionReceipts: {
          ...this.snapshot.sessionReceipts,
          [sessionId]: latest === void 0 ? { selectedCount: 0 } : { selectedCount: latest.selectedClaims.length, recallId: latest.id, createdAt: latest.createdAt }
        }
      });
    }).catch((error) => {
      this.update({ error: messageOf(error) });
    }).finally(() => {
      this.receiptLoads.delete(sessionId);
    });
    this.receiptLoads.set(sessionId, pending);
    return pending;
  }
  async request(endpoint, payload) {
    const result = await this.rpc.call(CONTINUITY_RPC_CHANNEL, endpoint, payload);
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
    return result.value;
  }
  update(patch) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
};

// src/client/styles.ts
var OWNER = "@telos/dsh-continuity";
var CONTINUITY_CLIENT_CSS = `
.telosContinuityFooterButton,
.telosContinuityHeaderButton {
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.telosContinuityFooterButton:hover,
.telosContinuityHeaderButton:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}
.telosContinuityFooterButton {
  box-sizing: border-box;
  width: 100%;
  min-height: 40px;
  gap: 10px;
  justify-content: flex-start;
  padding: 8px 12px;
  font-size: 14px;
}
.telosContinuityFooterButton[data-rail] {
  width: 40px;
  padding: 8px;
}
.telosContinuityHeaderButton {
  min-height: 28px;
  gap: 5px;
  padding: 3px 7px;
  font-size: 12px;
  line-height: 18px;
}
.telosContinuityBadge {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  color: var(--dsw-alias-label-primary-inverted);
  background: var(--dsw-alias-brand-primary);
  border-radius: 999px;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}
.telosContinuityBackdrop {
  position: fixed;
  z-index: 1200;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 32px;
  background: rgb(8 11 18 / 52%);
  backdrop-filter: blur(8px);
  -webkit-app-region: no-drag;
}
.telosContinuityDialog {
  box-sizing: border-box;
  width: min(1120px, calc(100vw - 64px));
  height: min(760px, calc(100vh - 64px));
  min-height: 520px;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 20px;
  box-shadow: 0 28px 90px rgb(0 0 0 / 32%);
  animation: telosContinuityIn 160ms ease-out;
}
@keyframes telosContinuityIn {
  from { opacity: 0; transform: translateY(10px) scale(.99); }
}
.telosContinuityTopbar {
  min-height: 72px;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 0 22px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.telosContinuityTitleBlock { min-width: 190px; }
.telosContinuityTitle {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -.01em;
}
.telosContinuitySubtitle {
  margin: 3px 0 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
}
.telosContinuitySearch {
  box-sizing: border-box;
  flex: 1;
  height: 38px;
  padding: 0 12px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  outline: none;
}
.telosContinuitySearch:focus { border-color: var(--dsw-alias-brand-primary); }
.telosContinuityIconButton {
  width: 34px;
  height: 34px;
  display: inline-grid;
  place-items: center;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 9px;
}
.telosContinuityIconButton:hover { background: var(--dsw-alias-interactive-bg-hover); }
.telosContinuityTabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 22px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.telosContinuityTab {
  min-height: 32px;
  padding: 5px 12px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
  font-size: 13px;
}
.telosContinuityTab[aria-selected='true'] {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-3);
  font-weight: 600;
}
.telosContinuityHealth {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
}
.telosContinuityHealthDot {
  width: 7px;
  height: 7px;
  background: var(--dsw-alias-label-tertiary);
  border-radius: 50%;
}
.telosContinuityHealthDot[data-health='ok'] { background: var(--dsw-alias-state-success-primary); }
.telosContinuityHealthDot[data-health='error'] { background: var(--dsw-alias-state-error-primary); }
.telosContinuityBody { min-height: 0; overflow: hidden; }
.telosContinuityMemoryGrid {
  height: 100%;
  display: grid;
  grid-template-columns: minmax(320px, 42%) minmax(0, 1fr);
}
.telosContinuityListPane,
.telosContinuityDetailPane,
.telosContinuityScrollPane {
  min-height: 0;
  overflow: auto;
}
.telosContinuityListPane { border-right: 1px solid var(--dsw-alias-border-l1); }
.telosContinuityFilters {
  position: sticky;
  z-index: 1;
  top: 0;
  display: flex;
  gap: 6px;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 94%, transparent);
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  backdrop-filter: blur(8px);
}
.telosContinuityFilter {
  padding: 4px 8px;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 11px;
}
.telosContinuityFilter[data-active] {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-3);
  border-color: var(--dsw-alias-border-l1);
}
.telosContinuityClaim {
  width: 100%;
  box-sizing: border-box;
  display: block;
  padding: 13px 15px;
  text-align: left;
  color: inherit;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.telosContinuityClaim:hover { background: var(--dsw-alias-interactive-bg-hover); }
.telosContinuityClaim[data-selected] {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, var(--dsw-alias-bg-layer-1));
}
.telosContinuityClaimMeta,
.telosContinuityMetaRow {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.telosContinuityClaimStatement {
  margin: 8px 0 5px;
  font-size: 13px;
  line-height: 20px;
}
.telosContinuityMuted {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
}
.telosContinuityChip {
  display: inline-flex;
  align-items: center;
  min-height: 19px;
  padding: 0 6px;
  color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-fill-l2);
  border-radius: 5px;
  font-size: 10px;
  line-height: 19px;
}
.telosContinuityChip[data-status='confirmed'] { color: var(--dsw-alias-state-success-primary); }
.telosContinuityChip[data-status='revoked'],
.telosContinuityChip[data-status='superseded'] { color: var(--dsw-alias-label-tertiary); }
.telosContinuityDetailPane { padding: 22px; }
.telosContinuityDetailTitle { margin: 0 0 8px; font-size: 17px; line-height: 25px; }
.telosContinuitySection { margin-top: 24px; }
.telosContinuitySectionTitle {
  margin: 0 0 10px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.telosContinuityDefinition {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 8px 12px;
  margin: 16px 0 0;
  font-size: 12px;
  line-height: 19px;
}
.telosContinuityDefinition dt { color: var(--dsw-alias-label-tertiary); }
.telosContinuityDefinition dd { margin: 0; overflow-wrap: anywhere; }
.telosContinuitySource,
.telosContinuityReceipt,
.telosContinuityGraphRow {
  padding: 12px;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
}
.telosContinuitySource + .telosContinuitySource,
.telosContinuityReceipt + .telosContinuityReceipt,
.telosContinuityGraphRow + .telosContinuityGraphRow { margin-top: 8px; }
.telosContinuitySourceContent {
  margin: 8px 0 0;
  padding: 8px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--dsw-alias-bg-layer-1);
  border-radius: 7px;
  font-size: 12px;
}
.telosContinuityEditGrid { display: grid; gap: 9px; }
.telosContinuityField {
  box-sizing: border-box;
  width: 100%;
  min-height: 36px;
  padding: 7px 10px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  font: inherit;
  resize: vertical;
}
.telosContinuityActions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.telosContinuityButton {
  min-height: 34px;
  padding: 6px 12px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  background: var(--dsw-alias-bg-layer-3);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  font-size: 12px;
}
.telosContinuityButton:hover { border-color: var(--dsw-alias-border-l2); }
.telosContinuityButton[data-primary] { color: white; background: var(--dsw-alias-brand-primary); border-color: transparent; }
.telosContinuityButton[data-danger] { color: var(--dsw-alias-state-error-primary); }
.telosContinuityButton:disabled { cursor: not-allowed; opacity: .5; }
.telosContinuityBanner {
  margin: 12px 18px 0;
  padding: 9px 11px;
  color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-bg-layer-2);
  border-radius: 8px;
  font-size: 12px;
}
.telosContinuityBanner[data-error] { color: var(--dsw-alias-state-error-primary); }
.telosContinuityEmpty {
  height: 100%;
  display: grid;
  place-items: center;
  padding: 30px;
  color: var(--dsw-alias-label-tertiary);
  text-align: center;
  font-size: 13px;
}
.telosContinuityContent { padding: 18px 22px 28px; }
.telosContinuityContentTitle { margin: 0 0 4px; font-size: 16px; }
.telosContinuityContentSubtitle { margin: 0 0 16px; color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.telosContinuityGraphRow {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(100px, auto) minmax(120px, 1fr);
  align-items: center;
  gap: 12px;
}
.telosContinuityNode {
  min-width: 0;
  padding: 9px 10px;
  text-align: center;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 9px;
  overflow-wrap: anywhere;
  font-size: 12px;
}
.telosContinuityEdge { color: var(--dsw-alias-label-tertiary); text-align: center; font-size: 11px; }
.telosContinuityEdge::after { content: ' \u2192'; }
.telosContinuityReceiptHeader { display: flex; align-items: center; gap: 8px; }
.telosContinuityReceiptQuery { margin: 8px 0 0; font-size: 13px; line-height: 20px; }
.telosContinuityReceiptClaims { margin: 8px 0 0; color: var(--dsw-alias-label-secondary); font-size: 11px; }
.telosContinuityAuditGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.telosContinuityAuditColumn { min-width: 0; }
.telosContinuitySpinner { animation: telosContinuitySpin .8s linear infinite; }
@keyframes telosContinuitySpin { to { transform: rotate(360deg); } }
@media (max-width: 820px) {
  .telosContinuityBackdrop { padding: 12px; }
  .telosContinuityDialog { width: calc(100vw - 24px); height: calc(100vh - 24px); }
  .telosContinuityMemoryGrid { grid-template-columns: 1fr; }
  .telosContinuityDetailPane { display: none; }
  .telosContinuityAuditGrid { grid-template-columns: 1fr; }
}
`;
function installContinuityStyles() {
  const existing = document.querySelector(`style[data-telos-style="${OWNER}"]`);
  if (existing !== null) return () => void 0;
  const style = document.createElement("style");
  style.dataset.telosStyle = OWNER;
  style.textContent = CONTINUITY_CLIENT_CSS;
  document.head.append(style);
  return () => style.remove();
}

// src/client/index.ts
var inject = ["slots", "connection"];
function apply(ctx) {
  const rpc = ctx.connection.rpc;
  const controller = new ContinuityClientController(rpc);
  const injected = () => ({ controller });
  ctx.effect(() => installContinuityStyles(), "telos-continuity: client styles");
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "telos-continuity",
    order: 50,
    inject: injected
  }, ContinuityOverlay));
  ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
    name: "sidebar.footer.action",
    id: "telos-continuity",
    order: -10,
    inject: injected
  }, ContinuityFooterAction));
  ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
    name: "conversation.session.header.utilities",
    id: "telos-continuity",
    order: 10,
    inject: injected
  }, ContinuityHeaderAction));
}

    return module.exports;
  },
});
