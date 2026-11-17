const storageKey = "studyflow.documents.v1";
const fontFamilies = [
  "Arial", "DM Sans", "Georgia", "Times New Roman",
  "Verdana", "Tahoma", "Trebuchet MS", "Courier New"
];
const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36];
const allowedTags = new Set([
  "P", "DIV", "BR", "H1", "H2", "H3", "UL", "OL", "LI", "BLOCKQUOTE",
  "STRONG", "B", "EM", "I", "U", "S", "STRIKE", "SPAN", "FONT"
]);
const dangerousTags = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH"]);
const fontSizeMap = { 1: "10px", 2: "13px", 3: "16px", 4: "18px", 5: "24px", 6: "32px", 7: "36px" };

export function countDocumentWords(text) {
  const words = String(text ?? "").match(/(?:\p{N}+(?:[.,]\p{N}+)*|[\p{L}\p{N}]+(?:['’‐‑–-][\p{L}\p{N}]+)*)/gu);
  return words ? words.length : 0;
}

export function getDocumentMetrics(text) {
  const plainText = String(text ?? "").replace(/\r\n?/g, "\n");
  const words = countDocumentWords(plainText);
  const paragraphs = plainText.split(/\n+/u).filter(paragraph => paragraph.trim()).length;
  return {
    words,
    characters: plainText.length,
    charactersWithoutSpaces: plainText.replace(/\s/gu, "").length,
    paragraphs,
    readingMinutes: words ? Math.max(1, Math.ceil(words / 200)) : 0
  };
}

function createDocument(title = "Untitled document") {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title,
    content: "<p><br></p>",
    updatedAt: new Date().toISOString()
  };
}

function isDocument(value) {
  return value && typeof value === "object"
    && typeof value.id === "string" && value.id.length > 0
    && typeof value.title === "string"
    && typeof value.content === "string"
    && value.content.length <= 2_000_000;
}

function readDocumentState() {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      const firstDocument = createDocument();
      return { state: { version: 1, activeId: firstDocument.id, documents: [firstDocument] }, error: "" };
    }

    const parsed = JSON.parse(stored);
    if (parsed?.version !== 1 || !Array.isArray(parsed.documents)
      || !parsed.documents.every(isDocument)) {
      return { state: { version: 1, activeId: "", documents: [] }, error: "Saved documents could not be read. Create a document to start a new local library." };
    }

    const documents = parsed.documents.map(document => ({
      ...document,
      title: document.title.trim().slice(0, 120) || "Untitled document"
    }));
    const activeId = documents.some(document => document.id === parsed.activeId)
      ? parsed.activeId
      : documents[0]?.id ?? "";
    return { state: { version: 1, activeId, documents }, error: "" };
  } catch {
    return { state: { version: 1, activeId: "", documents: [] }, error: "Browser storage is unavailable. Changes cannot be saved on this device." };
  }
}

function safeColor(value) {
  const candidate = String(value ?? "").trim();
  return /^#[\da-f]{3,8}$/i.test(candidate)
    || /^(?:rgb|rgba|hsl|hsla)\([\d.%\s,\/+-]+\)$/i.test(candidate)
    || /^(?:black|white|red|green|blue|yellow|purple|transparent|gray|grey|orange|navy|teal|maroon|lime|aqua|fuchsia|silver|olive)$/i.test(candidate);
}

function safeFontFamily(value) {
  const candidate = String(value ?? "").replaceAll('"', "").replaceAll("'", "").trim();
  return fontFamilies.find(font => font.toLowerCase() === candidate.toLowerCase()) ?? "";
}

function cleanInlineStyles(source, destination) {
  const styles = source.style;
  const family = safeFontFamily(styles.fontFamily || source.getAttribute("face"));
  if (family) destination.style.fontFamily = `"${family}"`;

  const size = styles.fontSize || fontSizeMap[source.getAttribute("size")];
  if (size && /^(?:[1-6]?\d(?:\.\d+)?)(?:px|pt|em|rem|%)$/i.test(size)
    && Number.parseFloat(size) <= 72) {
    destination.style.fontSize = size;
  }

  for (const property of ["color", "backgroundColor"]) {
    const value = styles[property] || (property === "color" ? source.getAttribute("color") : "");
    if (safeColor(value)) destination.style[property] = value;
  }

  const weight = styles.fontWeight;
  if (/^(?:normal|bold|[1-9]00)$/i.test(weight)) destination.style.fontWeight = weight;
  const fontStyle = styles.fontStyle;
  if (/^(?:normal|italic|oblique)$/i.test(fontStyle)) destination.style.fontStyle = fontStyle;
  const decoration = styles.textDecorationLine || styles.textDecoration;
  if (/^(?:none|underline|line-through|underline line-through)$/i.test(decoration)) {
    destination.style.textDecoration = decoration;
  }
  const alignment = styles.textAlign;
  if (/^(?:left|center|right|justify)$/i.test(alignment)) destination.style.textAlign = alignment;
}

function appendSanitized(parent, node) {
  if (node.nodeType === Node.TEXT_NODE) {
    parent.append(document.createTextNode(node.nodeValue ?? ""));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  if (dangerousTags.has(node.tagName)) return;

  if (!allowedTags.has(node.tagName)) {
    for (const child of node.childNodes) appendSanitized(parent, child);
    return;
  }

  const cleanNode = document.createElement(node.tagName.toLowerCase());
  cleanInlineStyles(node, cleanNode);
  for (const child of node.childNodes) appendSanitized(cleanNode, child);
  parent.append(cleanNode);
}

function sanitizeHtml(html) {
  const parsed = new DOMParser().parseFromString(String(html ?? ""), "text/html");
  const cleanContainer = document.createElement("div");
  for (const child of parsed.body.childNodes) appendSanitized(cleanContainer, child);
  return cleanContainer.innerHTML || "<p><br></p>";
}

function initDocumentWorkspace() {
  const root = document.querySelector("#documentWorkspace");
  if (!root) return;

  const editor = document.querySelector("#documentEditor");
  const titleInput = document.querySelector("#documentTitle");
  const documentPicker = document.querySelector("#documentPicker");
  const saveStatus = document.querySelector("#documentSaveStatus");
  const menuButton = document.querySelector("#documentMoreButton");
  const moreMenu = document.querySelector("#documentMoreMenu");
  const announcement = document.querySelector("#documentAnnouncement");
  const loaded = readDocumentState();
  let state = loaded.state;
  let savedSelection = null;
  let saveTimer = 0;
  let currentStatus = loaded.error ? "error" : "saved";

  function currentDocument() {
    return state.documents.find(document => document.id === state.activeId) ?? null;
  }

  function setStatus(message, status) {
    saveStatus.textContent = message;
    saveStatus.dataset.state = status;
    currentStatus = status;
  }

  function persistDocument() {
    const activeDocument = currentDocument();
    if (!activeDocument) return false;
    activeDocument.title = titleInput.value.trim().slice(0, 120) || "Untitled document";
    activeDocument.content = sanitizeHtml(editor.innerHTML);
    activeDocument.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      setStatus("Saved", "saved");
      return true;
    } catch {
      setStatus("Could not save — browser storage is unavailable", "error");
      return false;
    }
  }

  function updatePicker() {
    documentPicker.replaceChildren();
    for (const item of state.documents) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.title || "Untitled document";
      option.selected = item.id === state.activeId;
      documentPicker.append(option);
    }
    documentPicker.disabled = state.documents.length < 2;
  }

  function updateMetrics() {
    const metrics = getDocumentMetrics(editor.innerText ?? editor.textContent ?? "");
    document.querySelector("#documentWordCount").textContent = metrics.words.toLocaleString();
    document.querySelector("#documentCharacterCount").textContent = metrics.characters.toLocaleString();
    document.querySelector("#documentCharacterCountNoSpaces").textContent = metrics.charactersWithoutSpaces.toLocaleString();
    document.querySelector("#documentParagraphCount").textContent = metrics.paragraphs.toLocaleString();
    document.querySelector("#documentReadingTime").textContent = `${metrics.readingMinutes} min`;
  }

  function loadActiveDocument() {
    let activeDocument = currentDocument();
    if (!activeDocument) {
      activeDocument = createDocument();
      state.documents.push(activeDocument);
      state.activeId = activeDocument.id;
    }
    titleInput.value = activeDocument.title;
    editor.innerHTML = sanitizeHtml(activeDocument.content);
    updatePicker();
    updateMetrics();
  }

  function markDirty() {
    window.clearTimeout(saveTimer);
    setStatus("Saving…", "saving");
    const activeDocument = currentDocument();
    if (activeDocument) {
      activeDocument.title = titleInput.value.trim().slice(0, 120) || "Untitled document";
      activeDocument.content = editor.innerHTML;
      updatePicker();
    }
    updateMetrics();
    saveTimer = window.setTimeout(persistDocument, 450);
  }

  function saveBeforeSwitch() {
    window.clearTimeout(saveTimer);
    persistDocument();
  }

  function saveSelection() {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) savedSelection = range.cloneRange();
  }

  function restoreSelection() {
    editor.focus();
    if (!savedSelection || !editor.contains(savedSelection.commonAncestorContainer)) return;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedSelection);
  }

  function selectedTextNodes(range) {
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeValue && range.intersectsNode(node)) nodes.push(node);
    }
    return nodes;
  }

  function applyInlineStyle(property, value) {
    restoreSelection();
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0).cloneRange();
    const nodes = selectedTextNodes(range);
    const wrappers = [];

    for (const node of nodes.reverse()) {
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.length;
      if (end <= start) continue;
      const part = document.createRange();
      part.setStart(node, start);
      part.setEnd(node, end);
      const wrapper = document.createElement("span");
      wrapper.style[property] = value;
      wrapper.append(part.extractContents());
      part.insertNode(wrapper);
      wrappers.unshift(wrapper);
    }

    if (wrappers.length) {
      const updatedRange = document.createRange();
      updatedRange.setStart(wrappers[0].firstChild, 0);
      updatedRange.setEnd(wrappers.at(-1).firstChild, wrappers.at(-1).firstChild.textContent.length);
      selection.removeAllRanges();
      selection.addRange(updatedRange);
      savedSelection = updatedRange.cloneRange();
      markDirty();
    }
  }

  function topLevelBlock(node) {
    let element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    while (element && element.parentElement !== editor) element = element.parentElement;
    return element;
  }

  function selectBlockContents(blocks) {
    const textNodes = [];
    for (const block of blocks) {
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) textNodes.push(walker.currentNode);
    }
    if (!textNodes.length) return;
    const range = document.createRange();
    range.setStart(textNodes[0], 0);
    range.setEnd(textNodes.at(-1), textNodes.at(-1).length);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    savedSelection = range.cloneRange();
  }

  function convertList(list, requestedTag) {
    if (list.tagName === requestedTag) {
      const paragraphs = document.createDocumentFragment();
      const items = Array.from(list.children).filter(item => item.tagName === "LI");
      const converted = [];
      for (const item of items) {
        const paragraph = document.createElement("p");
        while (item.firstChild) paragraph.append(item.firstChild);
        paragraphs.append(paragraph);
        converted.push(paragraph);
      }
      list.replaceWith(paragraphs);
      return converted;
    }

    const replacement = document.createElement(requestedTag.toLowerCase());
    while (list.firstChild) replacement.append(list.firstChild);
    list.replaceWith(replacement);
    return [replacement];
  }

  function applyList(command) {
    restoreSelection();
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0).cloneRange();
    let blocks = Array.from(editor.children).filter(block => range.intersectsNode(block));
    if (range.collapsed) {
      const currentBlock = topLevelBlock(selection.anchorNode);
      if (currentBlock && !blocks.includes(currentBlock)) blocks = [currentBlock];
    }
    if (!blocks.length) return;

    const requestedTag = command === "insertOrderedList" ? "OL" : "UL";
    const listBlocks = blocks.filter(block => block.tagName === "UL" || block.tagName === "OL");
    const textBlocks = blocks.filter(block => !listBlocks.includes(block));
    const changedBlocks = [];

    for (const list of listBlocks) changedBlocks.push(...convertList(list, requestedTag));
    if (textBlocks.length) {
      const list = document.createElement(requestedTag.toLowerCase());
      for (const block of textBlocks) {
        const item = document.createElement("li");
        while (block.firstChild) item.append(block.firstChild);
        list.append(item);
      }
      textBlocks[0].before(list);
      for (const block of textBlocks) block.remove();
      changedBlocks.push(list);
    }

    if (changedBlocks.length) {
      selectBlockContents(changedBlocks);
      markDirty();
    }
  }

  function runCommand(command, value = null) {
    restoreSelection();
    const result = document.execCommand(command, false, value);
    editor.querySelectorAll("b,strong,i,em,u,s,strike,span").forEach(element => {
      if (!element.textContent && !element.querySelector("br,img")) element.remove();
    });
    saveSelection();
    if (result) markDirty();
  }

  function applyDocumentStyle(style) {
    const tags = { normal: "p", title: "h1", subtitle: "p", h1: "h1", h2: "h2", h3: "h3" };
    restoreSelection();
    const selection = window.getSelection();
    const anchor = selection?.anchorNode;
    const listItem = anchor?.nodeType === Node.ELEMENT_NODE
      ? anchor.closest("li")
      : anchor?.parentElement?.closest("li");
    if (listItem && editor.contains(listItem)) {
      listItem.style.fontSize = ({ title: "32px", subtitle: "18px", h1: "26px", h2: "21px", h3: "17px" })[style] ?? "";
      listItem.style.fontWeight = ({ title: "700", subtitle: "400", h1: "700", h2: "700", h3: "700" })[style] ?? "";
      listItem.style.color = style === "subtitle" ? "#707a74" : "";
      saveSelection();
      markDirty();
      return;
    }
    document.execCommand("formatBlock", false, `<${tags[style] ?? "p"}>`);
    const formattedAnchor = window.getSelection()?.anchorNode;
    const block = topLevelBlock(formattedAnchor);
    if (block && editor.contains(block)) {
      block.style.fontSize = ({ title: "32px", subtitle: "18px", h1: "26px", h2: "21px", h3: "17px" })[style] ?? "";
      block.style.fontWeight = ({ title: "700", subtitle: "400", h1: "700", h2: "700", h3: "700" })[style] ?? "";
      block.style.color = style === "subtitle" ? "#707a74" : "";
    }
    saveSelection();
    markDirty();
  }

  function updateTitle() {
    const activeDocument = currentDocument();
    if (!activeDocument) return;
    activeDocument.title = titleInput.value.trim().slice(0, 120) || "Untitled document";
    updatePicker();
    markDirty();
  }

  function closeMoreMenu() {
    moreMenu.hidden = true;
    menuButton.setAttribute("aria-expanded", "false");
  }

  function downloadDocument(format) {
    const activeDocument = currentDocument();
    if (!activeDocument) return;
    const safeTitle = (titleInput.value.trim() || "Untitled document")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, " ")
      .slice(0, 100);
    let content;
    let mimeType;
    let extension;

    if (format === "text") {
      const container = document.createElement("div");
      container.innerHTML = sanitizeHtml(editor.innerHTML);
      content = container.innerText || container.textContent || "";
      mimeType = "text/plain;charset=utf-8";
      extension = "txt";
    } else {
      content = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(titleInput.value.trim() || "Untitled document")}</title><style>body{max-width:760px;margin:48px auto;padding:0 24px;color:#202724;font:12pt/1.75 Arial,sans-serif}h1{font-size:26pt}h2{font-size:21pt}h3{font-size:17pt}img{max-width:100%}</style></head><body>${sanitizeHtml(editor.innerHTML)}</body></html>`;
      mimeType = "text/html;charset=utf-8";
      extension = "html";
    }

    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeTitle}.${extension}`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    announcement.textContent = `Downloaded ${link.download}.`;
  }

  function createNewDocument() {
    saveBeforeSwitch();
    const newDocument = createDocument();
    state.documents.unshift(newDocument);
    state.activeId = newDocument.id;
    loadActiveDocument();
    titleInput.focus();
    titleInput.select();
    persistDocument();
  }

  function deleteActiveDocument() {
    const activeDocument = currentDocument();
    if (!activeDocument) return;
    if (!window.confirm(`Delete “${activeDocument.title}”? This cannot be undone.`)) return;
    state.documents = state.documents.filter(document => document.id !== activeDocument.id);
    if (!state.documents.length) state.documents.push(createDocument());
    state.activeId = state.documents[0].id;
    loadActiveDocument();
    persistDocument();
  }

  document.addEventListener("selectionchange", saveSelection);
  editor.addEventListener("input", markDirty);
  editor.addEventListener("keyup", saveSelection);
  editor.addEventListener("mouseup", saveSelection);
  editor.addEventListener("paste", event => {
    event.preventDefault();
    const html = event.clipboardData?.getData("text/html");
    const text = event.clipboardData?.getData("text/plain") ?? "";
    restoreSelection();
    if (html) {
      const fragmentHolder = document.createElement("div");
      fragmentHolder.innerHTML = sanitizeHtml(html);
      const range = window.getSelection()?.getRangeAt(0);
      if (range) {
        range.deleteContents();
        const fragment = document.createDocumentFragment();
        while (fragmentHolder.firstChild) fragment.append(fragmentHolder.firstChild);
        range.insertNode(fragment);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else {
      document.execCommand("insertText", false, text);
    }
    saveSelection();
    markDirty();
  });
  titleInput.addEventListener("input", updateTitle);
  titleInput.addEventListener("blur", () => {
    if (!titleInput.value.trim()) {
      titleInput.value = "Untitled document";
      updateTitle();
    }
  });

  documentPicker.addEventListener("change", () => {
    saveBeforeSwitch();
    state.activeId = documentPicker.value;
    savedSelection = null;
    loadActiveDocument();
  });
  document.querySelector("#newDocumentButton").addEventListener("click", createNewDocument);
  document.querySelector("#saveDocumentButton").addEventListener("click", () => {
    window.clearTimeout(saveTimer);
    if (persistDocument()) announcement.textContent = "Document saved on this device.";
  });
  document.querySelector("#downloadDocumentButton").addEventListener("click", () => downloadDocument("html"));

  document.querySelectorAll(".toolbar-button[data-command]").forEach(button => {
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", () => {
      if (button.dataset.command === "insertUnorderedList" || button.dataset.command === "insertOrderedList") {
        applyList(button.dataset.command);
        return;
      }
      runCommand(button.dataset.command);
    });
  });
  document.querySelector("#documentStyle").addEventListener("change", event => applyDocumentStyle(event.target.value));
  document.querySelector("#documentFont").addEventListener("change", event => applyInlineStyle("fontFamily", `"${safeFontFamily(event.target.value)}"`));
  document.querySelector("#documentFontSize").addEventListener("change", event => {
    const size = Number(event.target.value);
    if (fontSizes.includes(size)) applyInlineStyle("fontSize", `${size}px`);
  });
  document.querySelector("#documentTextColor").addEventListener("input", event => applyInlineStyle("color", event.target.value));
  document.querySelector("#documentHighlightColor").addEventListener("input", event => applyInlineStyle("backgroundColor", event.target.value));
  document.querySelector("#clearFormattingButton").addEventListener("mousedown", event => event.preventDefault());
  document.querySelector("#clearFormattingButton").addEventListener("click", () => {
    runCommand("removeFormat");
    const selection = window.getSelection();
    const anchor = selection?.anchorNode;
    const listItem = anchor?.nodeType === Node.ELEMENT_NODE
      ? anchor.closest("li")
      : anchor?.parentElement?.closest("li");
    if (!listItem) runCommand("formatBlock", "<p>");
  });

  menuButton.addEventListener("click", () => {
    const isOpen = !moreMenu.hidden;
    moreMenu.hidden = isOpen;
    menuButton.setAttribute("aria-expanded", String(!isOpen));
  });
  moreMenu.addEventListener("click", event => {
    const action = event.target.closest("[data-document-action]")?.dataset.documentAction;
    closeMoreMenu();
    if (action === "download-text") downloadDocument("text");
    if (action === "delete") deleteActiveDocument();
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".document-menu-wrap")) closeMoreMenu();
  });

  document.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      window.clearTimeout(saveTimer);
      if (persistDocument()) announcement.textContent = "Document saved on this device.";
    }
  });
  window.addEventListener("pagehide", () => {
    window.clearTimeout(saveTimer);
    persistDocument();
  });

  if (loaded.error) setStatus(loaded.error, "error");
  else setStatus("Saved on this device", "saved");
  if (!state.documents.length) {
    state.documents.push(createDocument());
    state.activeId = state.documents[0].id;
  }
  loadActiveDocument();
  if (!loaded.error) persistDocument();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

if (typeof document !== "undefined") initDocumentWorkspace();
