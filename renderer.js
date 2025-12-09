const Editor = require("@toast-ui/editor");
const Sortable = require("sortablejs");
const Split = require("split.js");
const { ipcRenderer } = require("electron");

// --- 1. Split.js 설정 ---
Split(["#panel-memo", "#panel-todo", "#panel-ai"], {
  sizes: [40, 25, 35],
  minSize: [200, 200, 300],
  gutterSize: 6,
  cursor: "col-resize",
});

// --- 2. 에디터 설정 (위지윅 모드) ---
const editor = new Editor({
  el: document.querySelector("#editor"),
  height: "100%",
  initialEditType: "wysiwyg",
  previewStyle: "tab",
});

// 🔥 WYSIWYG 복사 시 줄바꿈 문제 해결
setTimeout(() => {
    const wwContainer = document.querySelector('.toastui-editor-ww-container .ProseMirror');
    if (wwContainer) {
        wwContainer.addEventListener('copy', (event) => {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            event.preventDefault();
            
            const range = selection.getRangeAt(0);
            const container = document.createElement("div");
            // 화면 밖으로 빼서 보이지 않게 처리
            container.style.position = "fixed";
            container.style.left = "-9999px";
            container.appendChild(range.cloneContents());
            
            document.body.appendChild(container);

            event.clipboardData.setData('text/html', container.innerHTML);
            
            let plainText = container.innerText;
            
            // Cleanup
            document.body.removeChild(container);

            // 윈도우/Chrome에서 <p> 태그 사이에는 보통 2개의 개행(\n\n)이 들어갑니다.
            // 텍스트 에디터처럼 줄바꿈 1번 당 \n 1개로 처리하기 위해 연속된 개행을 줄입니다.
            // 단, 사용자가 의도적으로 비운 줄(빈 p태그 등)은 보존되어야 하므로
            // 무조건적인 치환보다는 3개 이상의 개행을 2개로, 2개는 1개로 줄이는 전략이 안전할 수 있으나
            // 사용자 요청 "줄바꿈이 없어진다"는 detached element 문제일 가능성이 높으므로
            // 일단 기본적인 \n\n -> \n 변환만 유지하되, DOM 부착으로 해결되는지 봅니다.
            plainText = plainText.replace(/\n\n/g, '\n'); 
            
            event.clipboardData.setData('text/plain', plainText);
        });
    }
}, 1000); // 에디터 로딩 대기


editor.on("change", () => {
  localStorage.setItem("autoSaveContent", editor.getMarkdown());
  const status = document.getElementById("status-msg");
  if (status) {
    status.innerText = "메모 저장됨...";
    setTimeout(() => (status.innerText = ""), 1000);
  }
});

const savedContent = localStorage.getItem("autoSaveContent");
if (savedContent) editor.setMarkdown(savedContent);

document.getElementById("btn-save").addEventListener("click", async () => {
  const content = editor.getMarkdown();
  await ipcRenderer.invoke("save-file", content);
});

document.getElementById("btn-new").addEventListener("click", () => {
  editor.setMarkdown("");
  const status = document.getElementById("status-msg");
  if (status) {
      status.innerText = "새 파일";
      setTimeout(() => (status.innerText = ""), 1000);
  }
});


document.getElementById("btn-load").addEventListener("click", async () => {
  const result = await ipcRenderer.invoke("open-file");
  if (result) editor.setMarkdown(result.content);
});

// --- 검색 기능 ---
const searchContainer = document.getElementById("search-container");
const searchInput = document.getElementById("search-input");
const searchCount = document.getElementById("search-count");

function executeSearch(forward = true) {
  const text = searchInput.value;
  if (text) ipcRenderer.send("find-text", { text, forward });
}

function closeSearch() {
  searchContainer.classList.add("hidden");
  ipcRenderer.send("stop-find");
  searchCount.innerText = "";
  editor.focus();
}

document
  .getElementById("btn-search-next")
  .addEventListener("click", () => executeSearch(true));
document
  .getElementById("btn-search-prev")
  .addEventListener("click", () => executeSearch(false));
document
  .getElementById("btn-search-close")
  .addEventListener("click", closeSearch);

searchInput.addEventListener("input", () => executeSearch(true));
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (e.shiftKey) executeSearch(false);
    else executeSearch(true);
  }
  if (e.key === "Escape") closeSearch();
});

ipcRenderer.on("search-result", (event, result) => {
  if (result.activeMatchOrdinal) {
    searchCount.innerText = `${result.activeMatchOrdinal} / ${result.matches}`;
  } else {
    searchCount.innerText = "0 / 0";
  }
});

// --- 3. To-Do List 설정 ---
const listImmediate = document.getElementById("list-immediate");
const listBacklog = document.getElementById("list-backlog");
const listDone = document.getElementById("list-done");
const colDone = document.getElementById("col-done");
const toggleDone = document.getElementById("toggle-done");

[listImmediate, listBacklog, listDone].forEach((list) => {
  new Sortable(list, {
    group: "shared",
    animation: 150,
    onEnd: () => saveTodos(),
  });
});

toggleDone.addEventListener("change", (e) => {
  if (e.target.checked) colDone.classList.remove("hidden");
  else colDone.classList.add("hidden");
});

document.querySelectorAll(".toggle-list-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const block = btn.closest(".todo-block");
    const list = block.querySelector(".todo-list");
    list.classList.toggle("collapsed");
    btn.classList.toggle("collapsed");
  });
});

document.getElementById("btn-add-todo").addEventListener("click", addTodo);

// 메인 입력창 엔터 처리
document.getElementById("todo-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    addTodo();
  }
});

loadTodos();

async function loadTodos() {
  const data = await ipcRenderer.invoke("load-todo");
  if (data) {
    listImmediate.innerHTML = "";
    listBacklog.innerHTML = "";
    listDone.innerHTML = "";
    if (data.immediate)
      data.immediate.forEach((text) =>
        createTodoItem(text, listImmediate, false)
      );
    if (data.backlog)
      data.backlog.forEach((text) => createTodoItem(text, listBacklog, false));
    if (data.done)
      data.done.forEach((text) => createTodoItem(text, listDone, true));
  }
}

function saveTodos() {
  const data = {
    immediate: getListTexts(listImmediate),
    backlog: getListTexts(listBacklog),
    done: getListTexts(listDone),
  };
  ipcRenderer.invoke("save-todo", data).then(() => {
    const status = document.getElementById("status-msg");
    if (status) {
      status.innerText = "To-Do 저장됨...";
      status.style.color = "blue";
      setTimeout(() => {
        status.innerText = "";
        status.style.color = "green";
      }, 1000);
    }
  });
}

function getListTexts(ulElement) {
  const items = [];
  ulElement.querySelectorAll("li").forEach((li) => {
    const span = li.querySelector(".todo-text");
    const input = li.querySelector(".edit-input");
    if (input) items.push(input.value);
    else if (span) items.push(span.innerText);
  });
  return items;
}

function addTodo() {
  const input = document.getElementById("todo-input");
  const category = document.getElementById("todo-category").value;
  const text = input.value.trim();
  if (!text) return;
  createTodoItem(text, category === "immediate" ? listImmediate : listBacklog);
  saveTodos();
  input.value = "";
}

function createTodoItem(text, targetList, isDone = false) {
  const li = document.createElement("li");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = isDone;

  const span = document.createElement("span");
  span.className = "todo-text";
  span.innerText = text;
  span.style.whiteSpace = "pre-wrap"; // 줄바꿈 표시

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-btn";
  deleteBtn.innerHTML = "&times;";
  deleteBtn.title = "삭제";
  deleteBtn.addEventListener("click", () => {
    li.remove();
    saveTodos();
  });

  checkbox.addEventListener("change", function () {
    if (this.checked) {
      listDone.appendChild(li);
      span.style.textDecoration = "line-through";
      span.style.opacity = "0.6";
    } else {
      listImmediate.appendChild(li);
      span.style.textDecoration = "none";
      span.style.opacity = "1";
    }
    saveTodos();
  });

  // 🔥 핵심 수정 사항: 더블클릭 시 Textarea로 변환
  span.addEventListener("dblclick", function () {
    const currentText = span.innerText;

    // input이 아닌 textarea 생성
    const input = document.createElement("textarea");
    input.className = "edit-input";
    input.value = currentText;

    // 스타일 강제 지정 (높이 자동 조절을 위해)
    input.style.height = "auto";
    input.style.minHeight = "60px";
    input.style.overflowY = "hidden"; // 스크롤바 숨김

    // 내용에 맞춰 높이 늘리는 함수
    const autoResize = () => {
      input.style.height = "auto";
      input.style.height = input.scrollHeight + "px";
    };

    // 입력할 때마다 높이 조절
    input.addEventListener("input", autoResize);

    const finishEdit = () => {
      const newText = input.value.trim();
      if (newText) span.innerText = newText;
      else span.innerText = currentText;
      li.replaceChild(span, input);
      saveTodos();
    };

    input.addEventListener("blur", finishEdit);

    // 수정창에서 엔터 키 처리
    input.addEventListener("keydown", (e) => {
      // Shift 없이 Enter 누르면 저장
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        finishEdit();
      }
      // ESC 누르면 취소 (원래 값으로)
      if (e.key === "Escape") {
        span.innerText = currentText;
        li.replaceChild(span, input);
      }
    });

    li.replaceChild(input, span);

    // 포커스 후 높이 맞춤
    input.focus();
    autoResize();
  });

  li.appendChild(checkbox);
  li.appendChild(span);
  li.appendChild(deleteBtn);

  if (isDone) {
    span.style.textDecoration = "line-through";
    span.style.opacity = "0.6";
  }

  targetList.appendChild(li);
}

// --- 4. AI 탭 & 5. 단축키 ---
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabContents.forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    const targetId = btn.getAttribute("data-target");
    document.getElementById(targetId).classList.add("active");
  });
});

window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey) {
    const key = e.key.toLowerCase();
    if (key === "f") {
      e.preventDefault();
      searchContainer.classList.remove("hidden");
      searchInput.focus();
      searchInput.select();
    } else if (key === "1") {
      e.preventDefault();
      editor.exec("heading", { level: 1 });
    } else if (key === "2") {
      e.preventDefault();
      editor.exec("heading", { level: 2 });
    } else if (key === "3") {
      e.preventDefault();
      editor.exec("heading", { level: 3 });
    } else if (key === "4") {
      e.preventDefault();
      editor.exec("paragraph");
    }
  }
  if (e.key === "Escape") {
    if (!searchContainer.classList.contains("hidden")) {
      closeSearch();
    }
  }
});

// --- 6. AI 패널 화면 배율 설정 (90%) ---
const webviews = document.querySelectorAll("webview");
webviews.forEach((webview) => {
  // 웹뷰가 로드될 때마다 실행
  webview.addEventListener("dom-ready", () => {
    webview.setZoomFactor(0.9); // 1.0이 100%, 0.9가 90%입니다.
  });
});
