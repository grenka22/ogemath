// ==================== КОНСТАНТЫ ====================
const ADMIN_UID = "F0RuVaEotpWX0D7dYgW3Evsk7oo1";

let currentUser = null;
let currentUsername = null;
let currentTaskId = null;
let hintTimers = {};
let currentTopicFilter = "all";
let forumPosts = [];
let currentPostId = null;

// ==================== ДАННЫЕ ====================
let theoryData = [];
let practiceData = [];
let testData = [];

const topicsList = [
  { id: "all", name: "🎲 Все темы" },
  { id: "fractions", name: "Задание №6" },
  { id: "powers", name: "Задание №7" },
  { id: "equations", name: "Задание №8" },
  { id: "geometry", name: "Задание №9" }
];

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
window.addEventListener('DOMContentLoaded', async () => {
  console.log("🚀 Приложение загружается...");
  
  if (!window.onAuthStateChanged || !window.auth) {
    console.error("❌ Firebase ещё не загружен!");
    return;
  }

  loadTheme();
  await loadTheoryFromFirebase();
  await loadPracticeFromFirebase();
  await loadTestsFromFirebase();

  window.onAuthStateChanged(window.auth, async (user) => {
    if (user) {
      currentUser = user;
      console.log("✅ Пользователь вошёл:", user.uid);
      
      document.getElementById('login-screen')?.classList.add('hidden');
      document.getElementById('register-screen')?.classList.add('hidden');
      document.getElementById('main-menu')?.classList.remove('hidden');
      
      document.getElementById('user-name').textContent = currentUsername || user.email.split('@')[0];
      await loadUserData();
      
      showMemoryGame();
    } else {
      currentUser = null;
      currentUsername = null;
      document.getElementById('login-screen')?.classList.remove('hidden');
      document.getElementById('register-screen')?.classList.add('hidden');
      document.getElementById('main-menu')?.classList.add('hidden');
    }
  });
  
  initTopics();
  initImagePreview();
  initTestImagePreview();
});

// ==================== ЗАГРУЗКА ДАННЫХ ====================
async function loadTheoryFromFirebase() {
  try {
    const snapshot = await window.getDocs(window.collection(window.db, "theory"));
    theoryData = [];
    if (!snapshot.empty) {
      snapshot.forEach(doc => { theoryData.push({ id: doc.id, ...doc.data() }); });
    }
    console.log("📚 Теория загружена:", theoryData.length);
  } catch (e) { console.error("❌ Ошибка загрузки теории:", e); }
}

async function loadPracticeFromFirebase() {
  try {
    const snapshot = await window.getDocs(window.collection(window.db, "tasks"));
    practiceData = [];
    if (!snapshot.empty) {
      snapshot.forEach(doc => { practiceData.push({ id: parseInt(doc.id), ...doc.data() }); });
    }
    console.log("✏️ Практика загружена:", practiceData.length);
  } catch (e) { console.error("❌ Ошибка загрузки практики:", e); }
}

async function loadTestsFromFirebase() {
  try {
    const snapshot = await window.getDocs(window.collection(window.db, "tests"));
    testData = [];
    if (!snapshot.empty) {
      snapshot.forEach(doc => { testData.push({ id: doc.id, ...doc.data() }); });
    }
    console.log("📋 Тесты загружены:", testData.length);
  } catch (e) { console.error("❌ Ошибка загрузки тестов:", e); }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function initTopics() {
  const grid = document.getElementById('topics-grid');
  if (!grid) return;
  grid.innerHTML = '';
  topicsList.forEach(topic => {
    const btn = document.createElement('button');
    btn.className = 'topic-btn';
    btn.textContent = topic.name;
    btn.onclick = () => startTopicPractice(topic.id);
    grid.appendChild(btn);
  });
}

function initImagePreview() {
  const input = document.getElementById('new-task-image-url');
  const preview = document.getElementById('image-preview');
  if (input && preview) {
    input.addEventListener('input', function() {
      const url = this.value.trim();
      preview.innerHTML = url && url.startsWith('http') 
        ? `<img src="${url}" style="max-width:300px;max-height:200px;border-radius:5px;border:2px solid #ddd;">` 
        : '';
    });
  }
}

function initTestImagePreview() {
  const input = document.getElementById('test-question-image-url');
  const preview = document.getElementById('test-image-preview');
  if (input && preview) {
    input.addEventListener('input', function() {
      const url = this.value.trim();
      preview.innerHTML = url && url.startsWith('http') 
        ? `<img src="${url}" style="max-width:300px;max-height:200px;border-radius:5px;border:2px solid #ddd;">` 
        : '';
    });
  }
}

// ==================== НАВИГАЦИЯ ====================
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(screenId)?.classList.remove('hidden');
  
  if (screenId === 'theory-screen') showTheoryList();
  if (screenId === 'practice-screen') showTopicSelection();
  if (screenId === 'profile-screen') loadProfileStats();
  if (screenId === 'test-screen') { loadTestsFromFirebase(); showTestTopicSelection(); }
  if (screenId === 'forum-screen') { loadForumPosts(); showForum(); }
}

// ==================== АВТОРИЗАЦИЯ ====================
async function register() {
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;
  const confirm = document.getElementById('register-password-confirm').value;
  
  if (!username || !password) { document.getElementById('register-error').textContent = 'Введите имя и пароль!'; return; }
  if (password !== confirm) { document.getElementById('register-error').textContent = 'Пароли не совпадают!'; return; }
  if (password.length < 6) { document.getElementById('register-error').textContent = 'Пароль минимум 6 символов!'; return; }
  
  try {
    const fakeEmail = username.toLowerCase().replace(/\s/g, '') + '@oge.local';
    const cred = await window.createUserWithEmailAndPassword(window.auth, fakeEmail, password);
    await window.setDoc(window.doc(window.db, "users", cred.user.uid), {
      username, email: fakeEmail, createdAt: new Date(),
      progress: {}, mistakes: [], isAdmin: false
    });
    alert('✅ Регистрация успешна! Теперь войдите.');
    showScreen('login-screen');
  } catch (e) {
    document.getElementById('register-error').textContent = e.code === 'auth/email-already-in-use' ? 'Имя занято!' : e.message;
  }
}

async function login() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  if (!username || !password) { document.getElementById('login-error').textContent = 'Введите имя и пароль!'; return; }
  try {
    const fakeEmail = username.toLowerCase().replace(/\s/g, '') + '@oge.local';
    currentUsername = username;
    await window.signInWithEmailAndPassword(window.auth, fakeEmail, password);
  } catch (e) { document.getElementById('login-error').textContent = 'Неверное имя или пароль!'; }
}

async function logout() { await window.signOut(window.auth); currentUsername = null; }

async function loadUserData() {
  if (!currentUser) return;
  const doc = await window.getDoc(window.doc(window.db, "users", currentUser.uid));
  if (doc.exists()) {
    const data = doc.data();
    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) { if (data.isAdmin === true) adminBtn.classList.remove('hidden'); else adminBtn.classList.add('hidden'); }
    updateProgress(data.progress || {});
  }
}

function updateProgress(progress) {
  const total = practiceData.length;
  const done = Object.keys(progress).length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  document.getElementById('main-progress').style.width = percent + '%';
  document.getElementById('progress-text').textContent = percent + '%';
}

// ==================== ТЕОРИЯ ====================
function showTheoryList() {
  const list = document.getElementById('theory-list');
  if (!list) return;
  list.innerHTML = theoryData.map(t => `<div class="theory-topic"><h3>${t.number}: ${t.title}</h3><button onclick="showTheoryDetail(${t.id})">Открыть</button></div>`).join('');
}

function showTheoryDetail(id) {
  const topic = theoryData.find(t => t.id == id);
  if (!topic) return;
  document.getElementById('theory-list').innerHTML = `<button onclick="showTheoryList()" class="back-btn">← Назад</button><div class="theory-detail"><h2>${topic.number}: ${topic.title}</h2><div class="theory-content">${topic.content}</div></div>`;
}

// ==================== ПРАКТИКА ====================
function getTasksForCurrentTopic() { return currentTopicFilter === "all" ? practiceData : practiceData.filter(t => t.topic === currentTopicFilter); }
function showTopicSelection() { document.getElementById('topic-selection')?.classList.remove('hidden'); document.getElementById('task-container')?.classList.add('hidden'); initTopics(); }
function startTopicPractice(topicId) { currentTopicFilter = topicId; document.getElementById('topic-selection')?.classList.add('hidden'); document.getElementById('task-container')?.classList.remove('hidden'); loadTaskForIndex(1); }

function loadTaskForIndex(index) {
  const tasks = getTasksForCurrentTopic();
  if (index < 1) index = tasks.length; if (index > tasks.length) index = 1;
  const task = tasks[index - 1]; if (!task) return;
  currentTaskId = task.id;
  document.getElementById('task-number').textContent = task.number;
  document.getElementById('task-text').textContent = task.question;
  document.getElementById('user-answer').value = '';
  document.getElementById('result-message').innerHTML = '';
  document.getElementById('task-counter').textContent = `Задача ${index} из ${tasks.length}`;
  
  const oldImg = document.getElementById('task-image-display'); if (oldImg) oldImg.remove();
  if (task.imageUrl && task.imageUrl.trim() !== '' && task.imageUrl.startsWith('http')) {
    const imgContainer = document.createElement('div');
    imgContainer.id = 'task-image-display'; imgContainer.className = 'task-image-display';
    imgContainer.innerHTML = `<img src="${task.imageUrl}" class="task-image" alt="Задание" onerror="this.parentElement.style.display='none'">`;
    const taskText = document.getElementById('task-text'); taskText.parentNode.insertBefore(imgContainer, document.getElementById('user-answer'));
  }
  
  document.getElementById('hint-1-text')?.classList.add('hidden'); document.getElementById('hint-2-text')?.classList.add('hidden');
  const btn1 = document.getElementById('hint-btn-1'); const btn2 = document.getElementById('hint-btn-2');
  if (btn1) { btn1.disabled = true; btn1.textContent = '💡 Подсказка 1 (через 5 мин)'; }
  if (btn2) { btn2.disabled = true; btn2.textContent = '💡 Подсказка 2 (через 6.5 мин)'; }
  
  document.getElementById('prev-btn').style.display = index > 1 ? 'inline-block' : 'none';
  document.getElementById('next-btn').style.display = index < tasks.length ? 'inline-block' : 'none';
  document.getElementById('retry-btn').style.display = index === tasks.length ? 'inline-block' : 'none';
  
  if (hintTimers[task.id]) { clearTimeout(hintTimers[task.id].hint1); clearTimeout(hintTimers[task.id].hint2); }
  startHintTimersFast(task.id);
}

function startHintTimersFast(taskId) {
  hintTimers[taskId] = {
    hint1: setTimeout(() => { const btn = document.getElementById('hint-btn-1'); if (btn) { btn.disabled = false; btn.textContent = '💡 Подсказка 1 (доступна!)'; } }, 50000),
    hint2: setTimeout(() => { const btn = document.getElementById('hint-btn-2'); if (btn) { btn.disabled = false; btn.textContent = '💡 Подсказка 2 (доступна!)'; } }, 65000)
  };
}

function showHint(num) {
  const task = practiceData.find(t => t.id === currentTaskId); if (!task) return;
  if (num === 1) { const el = document.getElementById('hint-1-text'); if (el) { el.textContent = task.hint1; el.classList.remove('hidden'); } const btn = document.getElementById('hint-btn-1'); if (btn) btn.disabled = true; }
  else if (num === 2) { const el = document.getElementById('hint-2-text'); if (el) { el.textContent = task.hint2; el.classList.remove('hidden'); } const btn = document.getElementById('hint-btn-2'); if (btn) btn.disabled = true; }
}

function previousTask() { const tasks = getTasksForCurrentTopic(); const idx = tasks.findIndex(t => t.id === currentTaskId); if (idx > 0) loadTaskForIndex(idx); }
function nextTask() { const tasks = getTasksForCurrentTopic(); const idx = tasks.findIndex(t => t.id === currentTaskId); loadTaskForIndex(idx + 2); }
function solveAgain() { loadTaskForIndex(1); }

async function checkAnswer() {
  const task = practiceData.find(t => t.id === currentTaskId); if (!task) return;
  const userAns = document.getElementById('user-answer').value.trim().toLowerCase();
  const correct = task.correctAnswer.toString().toLowerCase();
  const result = document.getElementById('result-message');
  
  if (userAns === correct) {
    result.innerHTML = '<p class="success">✅ Правильно! Молодец!</p>';
    await saveProgress(task.id, true);
    const tasks = getTasksForCurrentTopic(); const idx = tasks.findIndex(t => t.id === currentTaskId); const isLast = idx === tasks.length - 1;
    result.innerHTML += `<div class="nav-buttons">${!isLast ? '<button onclick="nextTask()" class="nav-btn next">Следующая →</button>' : ''}<button onclick="solveAgain()" class="nav-btn retry">🔄 Ещё раз</button></div>`;
  } else {
    result.innerHTML = `<p class="error">❌ Неправильно!</p><div class="explanation-box"><p><strong>Объяснение:</strong> ${task.explanation}</p><button onclick="toggleSimpleExplanation()">Объяснить проще</button><p id="simple-explanation" class="hidden"><strong>Проще:</strong> ${task.simpleExplanation}</p></div><div class="nav-buttons"><button onclick="solveAgain()" class="nav-btn retry">🔄 Ещё раз</button></div>`;
    await saveProgress(task.id, false);
  }
}

function toggleSimpleExplanation() { document.getElementById('simple-explanation')?.classList.toggle('hidden'); }

async function saveProgress(taskId, isCorrect) {
  if (!currentUser) return;
  const ref = window.doc(window.db, "users", currentUser.uid);
  const doc = await window.getDoc(ref);
  if (doc.exists()) {
    const data = doc.data(); const progress = data.progress || {}; const mistakes = data.mistakes || [];
    if (isCorrect) progress[taskId] = { completed: true, completedAt: new Date() }; else mistakes.push({ taskId, attemptedAt: new Date() });
    await window.setDoc(ref, { progress, mistakes }, { merge: true }); updateProgress(progress);
  }
}

async function loadProfileStats() {
  if (!currentUser) return; const container = document.getElementById('profile-stats'); if (!container) return;
  const doc = await window.getDoc(window.doc(window.db, "users", currentUser.uid));
  if (doc.exists()) {
    const data = doc.data(); const progress = data.progress || {}; const mistakes = data.mistakes || [];
    const done = Object.keys(progress).length; const total = practiceData.length;
    const byTask = {}; mistakes.forEach(m => byTask[m.taskId] = (byTask[m.taskId] || 0) + 1);
    let errs = ''; for (const [id, cnt] of Object.entries(byTask)) { const t = practiceData.find(x => x.id == id); if (t) errs += `<li>Задание №${t.number}: ${cnt} ошиб.</li>`; }
    container.innerHTML = `<div class="stat-card"><h3>📊 Статистика</h3><p>Выполнено: <strong>${done} из ${total}</strong></p><p>Процент: <strong>${Math.round((done/total)*100)}%</strong></p><p>Ошибок: <strong>${mistakes.length}</strong></p></div><div class="stat-card"><h3>❌ Ошибки</h3>${errs ? '<ul>'+errs+'</ul>' : '<p>Ошибок нет! 🎉</p>'}</div>`;
  }
}

// ==================== ОБЪЯВЛЕНИЯ (видят все) ====================
async function loadForumPosts() {
  try {
    const snapshot = await window.getDocs(window.collection(window.db, "forum_posts"));
    forumPosts = [];
    if (!snapshot.empty) {
      snapshot.forEach(doc => { 
        forumPosts.push({ id: doc.id, ...doc.data() });
      });
    }
    forumPosts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    console.log("📢 Объявления загружены:", forumPosts.length);
  } catch (e) { console.error("❌ Ошибка загрузки объявлений:", e); }
}

function showForum() {
  const container = document.getElementById('forum-content');
  if (!container) return;
  
  const isAdmin = currentUser?.uid === ADMIN_UID;
  
  container.innerHTML = `
    <div style="margin-bottom: 20px;">
      ${isAdmin ? '<button onclick="showNewPostForm()" class="save-btn" style="width: auto;">➕ Новое объявление</button>' : ''}
    </div>
    
    <div id="new-post-form" class="hidden" style="margin: 20px 0; padding: 20px; background: rgba(0, 255, 136, 0.1); border-radius: 10px;">
      <input type="text" id="new-post-title" placeholder="Заголовок" style="width: 100%; padding: 10px; margin-bottom: 10px; border-radius: 5px; border: 2px solid #00ff88; background: #1a1a1a; color: #e0e0e0;">
      <textarea id="new-post-content" placeholder="Текст объявления..." style="width: 100%; padding: 10px; margin-bottom: 10px; border-radius: 5px; border: 2px solid #00ff88; background: #1a1a1a; color: #e0e0e0; min-height: 100px;"></textarea>
      <button onclick="createNewPost()" class="save-btn" style="width: auto;">💾 Опубликовать</button>
      <button onclick="hideNewPostForm()" class="back-btn" style="width: auto; margin-left: 10px;">✕ Отмена</button>
    </div>
    
    <div id="posts-list" class="forum-posts"></div>
  `;
  
  renderPostsList();
}

function showNewPostForm() {
  document.getElementById('new-post-form')?.classList.remove('hidden');
}

function hideNewPostForm() {
  document.getElementById('new-post-form')?.classList.add('hidden');
  document.getElementById('new-post-title').value = '';
  document.getElementById('new-post-content').value = '';
}

async function createNewPost() {
  const title = document.getElementById('new-post-title')?.value.trim();
  const content = document.getElementById('new-post-content')?.value.trim();
  
  if (!title || !content) { alert('❌ Заполните заголовок и текст!'); return; }
  
  try {
    const newPost = {
      title,
      content,
      authorId: currentUser.uid,
      authorName: currentUsername || 'Админ',
      createdAt: new Date()
    };
    
    await window.setDoc(window.doc(window.collection(window.db, "forum_posts")), newPost);
    
    hideNewPostForm();
    await loadForumPosts();
    renderPostsList();
    alert('✅ Объявление опубликовано!');
  } catch (e) {
    alert('❌ Ошибка: ' + e.message);
  }
}

function renderPostsList() {
  const container = document.getElementById('posts-list');
  if (!container) return;
  
  if (forumPosts.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">Пока нет объявлений</p>';
    return;
  }
  
  const isAdmin = currentUser?.uid === ADMIN_UID;
  
  container.innerHTML = forumPosts.map(post => {
    const time = post.createdAt?.seconds ? new Date(post.createdAt.seconds * 1000).toLocaleDateString('ru-RU') : '';
    
    return `
      <div class="forum-post" onclick="${isAdmin ? `openPost('${post.id}')` : ''}" style="${isAdmin ? 'cursor: pointer;' : ''}">
        <div class="forum-post-header">
          <h4>${post.title}</h4>
          <span class="forum-post-author">${post.authorName}</span>
        </div>
        <p class="forum-post-preview">${post.content.substring(0, 200)}${post.content.length > 200 ? '...' : ''}</p>
        <div class="forum-post-footer">
          <span class="forum-post-date">${time}</span>
        </div>
      </div>
    `;
  }).join('');
}

async function openPost(postId) {
  const post = forumPosts.find(p => p.id === postId);
  if (!post) return;
  
  currentPostId = postId;
  const container = document.getElementById('posts-list');
  if (!container) return;
  
  const time = post.createdAt?.seconds ? new Date(post.createdAt.seconds * 1000).toLocaleString('ru-RU') : '';
  const isAdmin = currentUser?.uid === ADMIN_UID;
  
  // Загружаем комментарии
  await loadComments(postId);
  
  container.innerHTML = `
    <button onclick="showForum()" class="back-btn">← Назад</button>
    
    <div class="forum-post-full">
      <div class="forum-post-header">
        <h2>${post.title}</h2>
        ${isAdmin ? `
          <div>
            <button onclick="editPost('${post.id}')" class="edit-btn" style="margin-right: 10px;">✏️ Редактировать</button>
            <button onclick="deletePost('${post.id}')" class="delete-btn">🗑 Удалить</button>
          </div>
        ` : ''}
      </div>
      <div class="forum-post-meta">
        <span class="forum-post-author">👤 ${post.authorName}</span>
        <span class="forum-post-date">📅 ${time}</span>
      </div>
      <div class="forum-post-content">${post.content.replace(/\n/g, '<br>')}</div>
    </div>
    
    <!-- Комментарии -->
    <div class="comments-section" style="margin-top: 30px;">
      <h3>💬 Комментарии (${post.comments?.length || 0})</h3>
      
      <div class="new-comment-form" style="margin: 20px 0;">
        <textarea id="new-comment-text" placeholder="Написать комментарий..." style="width: 100%; padding: 10px; margin-bottom: 10px; border-radius: 5px; border: 2px solid #00ff88; background: #1a1a1a; color: #e0e0e0; min-height: 80px;"></textarea>
        <button onclick="addComment()" class="save-btn" style="width: auto;">📤 Отправить</button>
      </div>
      
      <div id="comments-list" class="comments-list"></div>
    </div>
  `;
  
  renderComments();
}

async function editPost(postId) {
  const post = forumPosts.find(p => p.id === postId);
  if (!post) return;
  
  const newTitle = prompt('Новый заголовок:', post.title);
  if (!newTitle) return;
  
  const newContent = prompt('Новый текст:', post.content);
  if (!newContent) return;
  
  try {
    await window.setDoc(window.doc(window.db, "forum_posts", postId), {
      title: newTitle,
      content: newContent
    }, { merge: true });
    
    await loadForumPosts();
    openPost(postId);
    alert('✅ Обновлено!');
  } catch (e) {
    alert('❌ Ошибка: ' + e.message);
  }
}

async function deletePost(postId) {
  if (!confirm('Удалить это объявление?')) return;
  
  try {
    await window.deleteDoc(window.doc(window.db, "forum_posts", postId));
    await loadForumPosts();
    showForum();
    alert('✅ Удалено!');
  } catch (e) {
    alert('❌ Ошибка: ' + e.message);
  }
}

// Загрузка комментариев
async function loadComments(postId) {
  try {
    const snapshot = await window.getDocs(window.collection(window.db, "comments"));
    const post = forumPosts.find(p => p.id === postId);
    if (post) {
      post.comments = [];
      snapshot.forEach(doc => {
        const comment = { id: doc.id, ...doc.data() };
        if (comment.postId === postId) {
          post.comments.push(comment);
        }
      });
      post.comments.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    }
  } catch (e) { console.error("❌ Ошибка загрузки комментариев:", e); }
}

// Отображение комментариев
function renderComments() {
  const container = document.getElementById('comments-list');
  if (!container) return;
  
  const post = forumPosts.find(p => p.id === currentPostId);
  if (!post || !post.comments) return;
  
  if (post.comments.length === 0) {
    container.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">Пока нет комментариев. Будьте первыми!</p>';
    return;
  }
  
  container.innerHTML = post.comments.map(comment => {
    const time = comment.createdAt?.seconds ? new Date(comment.createdAt.seconds * 1000).toLocaleString('ru-RU') : '';
    return `
      <div class="comment" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; margin: 10px 0; border-left: 3px solid #00ff88;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px;">
          <span style="color: #00ff88; font-weight: bold;">👤 ${comment.authorName}</span>
          <span style="color: #666;">${time}</span>
        </div>
        <div style="color: #e0e0e0; line-height: 1.6;">${comment.content.replace(/\n/g, '<br>')}</div>
      </div>
    `;
  }).join('');
}

// Добавление комментария
async function addComment() {
  const text = document.getElementById('new-comment-text')?.value.trim();
  if (!text) { alert('❌ Введите текст комментария!'); return; }
  
  try {
    const newComment = {
      postId: currentPostId,
      content: text,
      authorId: currentUser.uid,
      authorName: currentUsername || 'Пользователь',
      createdAt: new Date()
    };
    
    await window.setDoc(window.doc(window.collection(window.db, "comments")), newComment);
    
    document.getElementById('new-comment-text').value = '';
    await loadComments(currentPostId);
    renderComments();
    await loadForumPosts(); // Обновить счётчик
    showForum(); // Перезагрузить чтобы обновился счётчик
    openPost(currentPostId);
  } catch (e) {
    alert('❌ Ошибка: ' + e.message);
  }
}

// ==================== АДМИНКА ====================
function showAdminTab(tabName) {
  document.querySelectorAll('.admin-tab-content').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('admin-' + tabName)?.classList.remove('hidden');
  if (event?.target) event.target.classList.add('active');
  
  if (tabName === 'users') loadAllUsers();
  else if (tabName === 'tasks') loadAllTasks();
  else if (tabName === 'tests') loadTestsAdmin();
  else if (tabName === 'theory') loadTheoryAdmin();
}

async function loadAllUsers() {
  const list = document.getElementById('users-list'); if (!list) return; list.innerHTML = '<p>Загрузка...</p>';
  try {
    const snap = await window.getDocs(window.collection(window.db, "users"));
    if (snap.empty) { list.innerHTML = '<p>Пользователей нет</p>'; return; }
    list.innerHTML = Array.from(snap.docs).map(d => {
      const data = d.data(); const prog = data.progress || {}; const errs = data.mistakes || [];
      return `<div class="user-card"><h4>${data.username||'Без имени'} (${data.email||'нет'})</h4><p>Зарегистрирован: ${data.createdAt ? new Date(data.createdAt.seconds*1000).toLocaleDateString() : '?'}</p><p>Выполнено: ${Object.keys(prog).length} | Ошибок: ${errs.length}</p><p>Статус: ${data.isAdmin ? '👑 Админ' : '👤 Ученик'}</p></div>`;
    }).join('');
  } catch (e) { list.innerHTML = `<p class="error">Ошибка: ${e.message}</p>`; }
}

function loadAllTasks() {
  const list = document.getElementById('tasks-list'); if (!list) return;
  list.innerHTML = practiceData.length === 0 ? '<p>Заданий нет</p>' : practiceData.map((t, i) => `<div class="task-card"><div class="task-card-header"><strong>№${t.number}</strong><span class="task-topic">${t.topicName}</span></div><p class="task-question-preview">${t.question}</p>${t.imageUrl ? `<img src="${t.imageUrl}" style="max-width:100px;border-radius:5px;margin:5px 0;">` : ''}<p class="task-answer">Ответ: ${t.correctAnswer}</p><button onclick="editTask(${i})" class="edit-btn">✏️</button><button onclick="deleteTask(${i})" class="delete-btn">🗑</button></div>`).join('');
}

async function addNewTask() {
  const number = document.getElementById('new-task-number').value; const topic = document.getElementById('new-task-topic').value; const question = document.getElementById('new-task-question').value;
  const imageUrl = document.getElementById('new-task-image-url').value.trim(); const answer = document.getElementById('new-task-answer').value;
  const explanation = document.getElementById('new-task-explanation').value; const simple = document.getElementById('new-task-simple').value;
  const hint1 = document.getElementById('new-task-hint1').value; const hint2 = document.getElementById('new-task-hint2').value;
  if (!number || !answer) { document.getElementById('admin-message').textContent = '❌ Заполните обязательные поля!'; document.getElementById('admin-message').className = 'error-msg'; return; }
  const names = { fractions:'Задание №6', powers:'Задание №7', equations:'Задание №8', geometry:'Задание №9' };
  const newTask = { id: Date.now(), number: parseInt(number), topic, topicName: names[topic], question, imageUrl: imageUrl || null, correctAnswer: answer, explanation, simpleExplanation: simple, hint1, hint2 };
  try {
    await window.setDoc(window.doc(window.db, "tasks", newTask.id.toString()), newTask); practiceData.push(newTask);
    document.getElementById('admin-message').textContent = '✅ Сохранено!'; document.getElementById('admin-message').className = 'success-msg';
    document.getElementById('new-task-number').value = ''; document.getElementById('new-task-topic').value = 'fractions';
    document.getElementById('new-task-question').value = ''; document.getElementById('new-task-image-url').value = '';
    document.getElementById('new-task-answer').value = ''; document.getElementById('new-task-explanation').value = '';
    document.getElementById('new-task-simple').value = ''; document.getElementById('new-task-hint1').value = '';
    document.getElementById('new-task-hint2').value = ''; document.getElementById('image-preview').innerHTML = '';
    loadAllTasks();
  } catch (e) { document.getElementById('admin-message').textContent = '❌ Ошибка: ' + e.message; document.getElementById('admin-message').className = 'error-msg'; }
}

function editTask(index) {
  const t = practiceData[index]; if (!t) return; showAdminTab('add-task');
  document.getElementById('new-task-number').value = t.number; document.getElementById('new-task-topic').value = t.topic;
  document.getElementById('new-task-question').value = t.question; document.getElementById('new-task-image-url').value = t.imageUrl || '';
  document.getElementById('new-task-answer').value = t.correctAnswer; document.getElementById('new-task-explanation').value = t.explanation;
  document.getElementById('new-task-simple').value = t.simpleExplanation; document.getElementById('new-task-hint1').value = t.hint1;
  document.getElementById('new-task-hint2').value = t.hint2;
  const preview = document.getElementById('image-preview'); if (preview && t.imageUrl) preview.innerHTML = `<img src="${t.imageUrl}" style="max-width:300px;max-height:200px;border-radius:5px;">`;
  const btn = document.querySelector('#admin-add-task .save-btn'); if (btn) { btn.textContent = '🔄 Обновить'; btn.onclick = () => updateTask(index); }
  document.getElementById('admin-message').textContent = '✏️ Редактирование №' + t.number;
}

async function updateTask(index) {
  const names = { fractions:'Задание №6', powers:'Задание №7', equations:'Задание №8', geometry:'Задание №9' };
  practiceData[index] = { ...practiceData[index], number: parseInt(document.getElementById('new-task-number').value), topic: document.getElementById('new-task-topic').value, topicName: names[document.getElementById('new-task-topic').value], question: document.getElementById('new-task-question').value, imageUrl: document.getElementById('new-task-image-url').value.trim() || null, correctAnswer: document.getElementById('new-task-answer').value, explanation: document.getElementById('new-task-explanation').value, simpleExplanation: document.getElementById('new-task-simple').value, hint1: document.getElementById('new-task-hint1').value, hint2: document.getElementById('new-task-hint2').value };
  try {
    const t = practiceData[index]; await window.setDoc(window.doc(window.db, "tasks", t.id.toString()), t);
    document.getElementById('admin-message').textContent = '✅ Обновлено!'; document.getElementById('admin-message').className = 'success-msg';
    const btn = document.querySelector('#admin-add-task .save-btn'); if (btn) { btn.textContent = '💾 Сохранить'; btn.onclick = addNewTask; }
    loadAllTasks();
  } catch (e) { document.getElementById('admin-message').textContent = '❌ Ошибка: ' + e.message; document.getElementById('admin-message').className = 'error-msg'; }
}

async function deleteTask(index) { if (!confirm('Удалить задание?')) return; const t = practiceData[index]; if (!t || !t.id) { alert('Ошибка: задание не найдено!'); return; } try { console.log("🗑 Удаляю задание ID:", t.id); const taskRef = window.doc(window.db, "tasks", t.id.toString()); await window.deleteDoc(taskRef); practiceData.splice(index, 1); loadAllTasks(); console.log("✅ Задание удалено"); } catch (e) { console.error("❌ Ошибка удаления:", e); alert('Ошибка: ' + e.message); } }

// ==================== УПРАВЛЕНИЕ ТЕОРИЕЙ ====================
function loadTheoryAdmin() { const list = document.getElementById('theory-list-admin'); if (!list) return; list.innerHTML = theoryData.length === 0 ? '<p>Теории нет</p>' : theoryData.map((t, i) => `<div class="theory-card"><div class="theory-card-header"><strong>${t.number}</strong><span>${t.title}</span></div><button onclick="editTheory(${i})" class="edit-btn">✏️</button><button onclick="deleteTheory(${i})" class="delete-btn">🗑</button></div>`).join(''); }

async function saveTheory() { const number = document.getElementById('theory-number').value; const title = document.getElementById('theory-title').value; const content = document.getElementById('theory-content').value; const msg = document.getElementById('theory-message'); if (!number || !title || !content) { msg.textContent = '❌ Заполните все поля!'; msg.className = 'error-msg'; return; } const newT = { id: Date.now(), number, title, content }; try { await window.setDoc(window.doc(window.db, "theory", newT.id.toString()), newT); theoryData.push(newT); msg.textContent = '✅ Сохранено!'; msg.className = 'success-msg'; document.getElementById('theory-number').value = ''; document.getElementById('theory-title').value = ''; document.getElementById('theory-content').value = ''; loadTheoryAdmin(); } catch (e) { console.error("Ошибка:", e); msg.textContent = '❌ Ошибка: ' + e.message; msg.className = 'error-msg'; } }

function editTheory(index) { const t = theoryData[index]; if (!t) return; document.getElementById('theory-number').value = t.number; document.getElementById('theory-title').value = t.title; document.getElementById('theory-content').value = t.content; const btn = document.querySelector('#admin-theory .save-btn'); if (btn) { btn.textContent = '🔄 Обновить'; btn.onclick = () => updateTheory(index); } document.getElementById('theory-message').textContent = '✏️ Редактирование'; }

async function updateTheory(index) { const t = theoryData[index]; if (!t) return; const updated = { ...t, number: document.getElementById('theory-number').value, title: document.getElementById('theory-title').value, content: document.getElementById('theory-content').value }; try { await window.setDoc(window.doc(window.db, "theory", t.id.toString()), updated); theoryData[index] = updated; const msg = document.getElementById('theory-message'); msg.textContent = '✅ Обновлено!'; msg.className = 'success-msg'; const btn = document.querySelector('#admin-theory .save-btn'); if (btn) { btn.textContent = '💾 Сохранить'; btn.onclick = saveTheory; } loadTheoryAdmin(); } catch (e) { console.error("Ошибка:", e); document.getElementById('theory-message').textContent = '❌ Ошибка: ' + e.message; } }

async function deleteTheory(index) { if (!confirm('Удалить теорию?')) return; const t = theoryData[index]; if (!t || !t.id) { alert('Ошибка: теория не найдена!'); return; } try { console.log("🗑 Удаляю теорию ID:", t.id); const theoryRef = window.doc(window.db, "theory", t.id.toString()); await window.deleteDoc(theoryRef); theoryData.splice(index, 1); loadTheoryAdmin(); console.log("✅ Теория удалена"); } catch (e) { console.error("❌ Ошибка удаления:", e); alert('Ошибка: ' + e.message); } }

// ==================== ТЕСТЫ ====================
let currentTestTopic = "all"; let currentTestIndex = 0; let testAnswers = {}; let testScore = 0;

function initTestTopics() { const grid = document.getElementById('test-topics-grid'); if (!grid) return; grid.innerHTML = ''; topicsList.forEach(topic => { const btn = document.createElement('button'); btn.className = 'topic-btn'; btn.textContent = topic.name; btn.onclick = () => startTest(topic.id); grid.appendChild(btn); }); }
function showTestTopicSelection() { document.getElementById('test-topic-selection')?.classList.remove('hidden'); document.getElementById('test-container')?.classList.add('hidden'); document.getElementById('test-final-result')?.classList.add('hidden'); initTestTopics(); }
function startTest(topicId) { currentTestTopic = topicId; currentTestIndex = 0; testAnswers = {}; testScore = 0; document.getElementById('test-topic-selection')?.classList.add('hidden'); document.getElementById('test-container')?.classList.remove('hidden'); document.getElementById('test-final-result')?.classList.add('hidden'); loadTestQuestion(0); }
function getTestQuestionsForTopic() { if (currentTestTopic === "all") return testData; return testData.filter(q => q.topic === currentTestTopic); }

function loadTestQuestion(index) {
  const questions = getTestQuestionsForTopic(); if (questions.length === 0) { document.getElementById('test-question-text').textContent = 'Вопросов пока нет. Добавьте их в админке!'; return; }
  if (index < 0) index = 0; if (index >= questions.length) index = questions.length - 1; currentTestIndex = index; const question = questions[index];
  document.getElementById('test-question-number').textContent = index + 1; document.getElementById('test-counter').textContent = `Вопрос ${index + 1} из ${questions.length}`;
  document.getElementById('test-question-text').textContent = question.question; document.getElementById('test-result-message').innerHTML = '';
  const imgDisplay = document.getElementById('test-image-display'); if (imgDisplay) { imgDisplay.innerHTML = ''; if (question.imageUrl && question.imageUrl.trim() !== '' && question.imageUrl.startsWith('http')) imgDisplay.innerHTML = `<img src="${question.imageUrl}" class="task-image" alt="Вопрос">`; }
  const answersContainer = document.getElementById('test-answers'); if (answersContainer) { answersContainer.innerHTML = ''; const options = [question.option1, question.option2, question.option3, question.option4].filter(opt => opt && opt.trim() !== ''); options.forEach((option, i) => { const btn = document.createElement('button'); btn.className = 'test-answer-btn'; btn.textContent = option; btn.dataset.index = i; btn.onclick = () => selectTestAnswer(index, i, btn); if (testAnswers[index] !== undefined) { btn.disabled = true; if (i === testAnswers[index]) btn.classList.add('selected'); if (i === parseInt(question.correctOption) - 1) btn.classList.add('correct'); if (testAnswers[index] === i && i !== parseInt(question.correctOption) - 1) btn.classList.add('wrong'); } answersContainer.appendChild(btn); }); }
  document.getElementById('test-prev-btn').style.display = index > 0 ? 'inline-block' : 'none'; document.getElementById('test-next-btn').style.display = index < questions.length - 1 ? 'inline-block' : 'none'; document.getElementById('test-finish-btn').style.display = index === questions.length - 1 ? 'inline-block' : 'none';
}

function selectTestAnswer(questionIndex, answerIndex, btn) { if (testAnswers[questionIndex] !== undefined) return; testAnswers[questionIndex] = answerIndex; const questions = getTestQuestionsForTopic(); const question = questions[questionIndex]; const correctIndex = parseInt(question.correctOption) - 1; const allBtns = document.querySelectorAll('.test-answer-btn'); allBtns.forEach(b => b.disabled = true); if (answerIndex === correctIndex) { btn.classList.add('correct'); testScore++; } else { btn.classList.add('wrong'); allBtns[correctIndex]?.classList.add('correct'); } if (question.explanation) document.getElementById('test-result-message').innerHTML = `<div class="explanation-box"><p><strong>Объяснение:</strong> ${question.explanation}</p></div>`; }
function previousTestQuestion() { loadTestQuestion(currentTestIndex - 1); }
function nextTestQuestion() { loadTestQuestion(currentTestIndex + 1); }

function finishTest() { const questions = getTestQuestionsForTopic(); const answeredCount = Object.keys(testAnswers).length; if (answeredCount < questions.length && !confirm(`Вы ответили на ${answeredCount} из ${questions.length} вопросов. Завершить тест?`)) return; document.getElementById('test-final-result').classList.remove('hidden'); document.getElementById('test-correct-count').textContent = testScore; document.getElementById('test-total-count').textContent = questions.length; document.getElementById('test-percent').textContent = Math.round((testScore / questions.length) * 100); saveTestResult(testScore, questions.length); }

async function saveTestResult(score, total) { if (!currentUser) return; try { const userRef = window.doc(window.db, "users", currentUser.uid); const userDoc = await window.getDoc(userRef); if (userDoc.exists()) { const data = userDoc.data(); const testResults = data.testResults || []; testResults.push({ date: new Date(), topic: currentTestTopic, score, total, percent: Math.round((score / total) * 100) }); if (testResults.length > 10) testResults.splice(0, testResults.length - 10); await window.setDoc(userRef, { testResults }, { merge: true }); } } catch (e) { console.error("Ошибка сохранения результата теста:", e); } }
function restartTest() { startTest(currentTestTopic); }

// ==================== АДМИНКА: ТЕСТЫ ====================
function loadTestsAdmin() { const list = document.getElementById('tests-list-admin'); if (!list) return; list.innerHTML = testData.length === 0 ? '<p>Вопросов для тестов пока нет</p>' : testData.map((t, i) => `<div class="test-question-card"><div class="test-question-card-header"><strong>Вопрос #${t.id}</strong><span class="task-topic">${t.topicName || 'Общая'}</span></div><p>${t.question}</p>${t.imageUrl ? `<img src="${t.imageUrl}" alt="Вопрос">` : ''}<p><strong>Варианты:</strong> ${t.option1} | ${t.option2} | ${t.option3} | ${t.option4}</p><p><strong>Правильный:</strong> Вариант ${t.correctOption}</p><button onclick="editTestQuestion(${i})" class="edit-btn">✏️</button><button onclick="deleteTestQuestion(${i})" class="delete-btn">🗑</button></div>`).join(''); }

async function addTestQuestion() { const topic = document.getElementById('test-question-topic').value; const question = document.getElementById('test-question-text').value; const imageUrl = document.getElementById('test-question-image-url').value.trim(); const option1 = document.getElementById('test-option-1').value; const option2 = document.getElementById('test-option-2').value; const option3 = document.getElementById('test-option-3').value; const option4 = document.getElementById('test-option-4').value; const correctOption = document.getElementById('test-correct-option').value; const explanation = document.getElementById('test-question-explanation').value; if (!question || !option1 || !option2 || !correctOption) { document.getElementById('test-admin-message').textContent = '❌ Заполните обязательные поля!'; document.getElementById('test-admin-message').className = 'error-msg'; return; } const names = { fractions:'Задание №6', powers:'Задание №7', equations:'Задание №8', geometry:'Задание №9' }; const newQuestion = { id: Date.now(), topic, topicName: names[topic], question, imageUrl: imageUrl || null, option1, option2, option3, option4, correctOption, explanation }; try { await window.setDoc(window.doc(window.db, "tests", newQuestion.id.toString()), newQuestion); testData.push(newQuestion); document.getElementById('test-admin-message').textContent = '✅ Вопрос сохранён!'; document.getElementById('test-admin-message').className = 'success-msg'; document.getElementById('test-question-topic').value = 'fractions'; document.getElementById('test-question-text').value = ''; document.getElementById('test-question-image-url').value = ''; document.getElementById('test-option-1').value = ''; document.getElementById('test-option-2').value = ''; document.getElementById('test-option-3').value = ''; document.getElementById('test-option-4').value = ''; document.getElementById('test-question-explanation').value = ''; document.getElementById('test-image-preview').innerHTML = ''; loadTestsAdmin(); } catch (e) { document.getElementById('test-admin-message').textContent = '❌ Ошибка: ' + e.message; document.getElementById('test-admin-message').className = 'error-msg'; } }

function editTestQuestion(index) { const t = testData[index]; if (!t) return; document.getElementById('test-question-topic').value = t.topic; document.getElementById('test-question-text').value = t.question; document.getElementById('test-question-image-url').value = t.imageUrl || ''; document.getElementById('test-option-1').value = t.option1; document.getElementById('test-option-2').value = t.option2; document.getElementById('test-option-3').value = t.option3; document.getElementById('test-option-4').value = t.option4; document.getElementById('test-correct-option').value = t.correctOption; document.getElementById('test-question-explanation').value = t.explanation || ''; const preview = document.getElementById('test-image-preview'); if (preview && t.imageUrl) preview.innerHTML = `<img src="${t.imageUrl}" style="max-width:300px;max-height:200px;border-radius:5px;">`; const btn = document.querySelector('#admin-tests .save-btn'); if (btn) { btn.textContent = '🔄 Обновить'; btn.onclick = () => updateTestQuestion(index); } document.getElementById('test-admin-message').textContent = '✏️ Редактирование'; }

async function updateTestQuestion(index) { const names = { fractions:'Задание №6', powers:'Задание №7', equations:'Задание №8', geometry:'Задание №9' }; testData[index] = { ...testData[index], topic: document.getElementById('test-question-topic').value, topicName: names[document.getElementById('test-question-topic').value], question: document.getElementById('test-question-text').value, imageUrl: document.getElementById('test-question-image-url').value.trim() || null, option1: document.getElementById('test-option-1').value, option2: document.getElementById('test-option-2').value, option3: document.getElementById('test-option-3').value, option4: document.getElementById('test-option-4').value, correctOption: document.getElementById('test-correct-option').value, explanation: document.getElementById('test-question-explanation').value }; try { const t = testData[index]; await window.setDoc(window.doc(window.db, "tests", t.id.toString()), t); document.getElementById('test-admin-message').textContent = '✅ Обновлено!'; document.getElementById('test-admin-message').className = 'success-msg'; const btn = document.querySelector('#admin-tests .save-btn'); if (btn) { btn.textContent = '💾 Сохранить'; btn.onclick = addTestQuestion; } loadTestsAdmin(); } catch (e) { document.getElementById('test-admin-message').textContent = '❌ Ошибка: ' + e.message; document.getElementById('test-admin-message').className = 'error-msg'; } }

async function deleteTestQuestion(index) { if (!confirm('Удалить вопрос?')) return; const t = testData[index]; try { await window.deleteDoc(window.doc(window.db, "tests", t.id.toString())); testData.splice(index, 1); loadTestsAdmin(); } catch (e) { alert('Ошибка: ' + e.message); } }

// ==================== ИГРА НА ПАМЯТЬ ====================
let gameCards = [], flippedCards = [], matchedPairs = 0, moves = 0, gameTimer = null, gameTime = 0, isGameActive = false;
const memoryGameData = [ { id: 1, question: "Площадь круга", answer: "S = πr²" }, { id: 2, question: "Сумма углов треугольника", answer: "180°" }, { id: 3, question: "Квадрат суммы", answer: "(a+b)² = a²+2ab+b²" }, { id: 4, question: "Дискриминант", answer: "D = b²-4ac" }, { id: 5, question: "Теорема Пифагора", answer: "a²+b²=c²" }, { id: 6, question: "Процент от числа", answer: "число × % ÷ 100" }, { id: 7, question: "Длина окружности", answer: "C = 2πr" }, { id: 8, question: "Корень из произведения", answer: "√(ab) = √a × √b" } ];

async function showMemoryGame() { if (!currentUser) return; const userDoc = await window.getDoc(window.doc(window.db, "users", currentUser.uid)); if (userDoc.exists() && userDoc.data().isAdmin) return; document.getElementById('memory-game-modal').classList.remove('hidden'); initMemoryGame(); }
function initMemoryGame() { flippedCards = []; matchedPairs = 0; moves = 0; gameTime = 0; isGameActive = true; document.getElementById('game-moves').textContent = '0'; document.getElementById('game-time').textContent = '0:00'; document.getElementById('game-pairs').textContent = '0/8'; document.getElementById('game-result').classList.add('hidden'); const cards = []; memoryGameData.forEach(item => { cards.push({ id: item.id, content: item.question, type: 'question' }); cards.push({ id: item.id, content: item.answer, type: 'answer' }); }); shuffleArray(cards); const board = document.getElementById('game-board'); board.innerHTML = ''; cards.forEach((card, index) => { const cardEl = document.createElement('div'); cardEl.className = 'game-card'; cardEl.dataset.id = card.id; cardEl.dataset.index = index; cardEl.innerHTML = `<div class="game-card-inner"><div class="game-card-front">?</div><div class="game-card-back">${card.content}</div></div>`; cardEl.onclick = () => flipCard(cardEl); board.appendChild(cardEl); }); startGameTimer(); }
function shuffleArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } }
function flipCard(cardEl) { if (!isGameActive || cardEl.classList.contains('flipped') || cardEl.classList.contains('matched') || flippedCards.length >= 2) return; cardEl.classList.add('flipped'); flippedCards.push(cardEl); if (flippedCards.length === 2) { moves++; document.getElementById('game-moves').textContent = moves; checkMatch(); } }
function checkMatch() { const [card1, card2] = flippedCards; const match = card1.dataset.id === card2.dataset.id; if (match) { card1.classList.add('matched'); card2.classList.add('matched'); matchedPairs++; document.getElementById('game-pairs').textContent = `${matchedPairs}/8`; flippedCards = []; if (matchedPairs === 8) endGame(); } else { setTimeout(() => { card1.classList.remove('flipped'); card2.classList.remove('flipped'); flippedCards = []; }, 1000); } }
function startGameTimer() { if (gameTimer) clearInterval(gameTimer); gameTimer = setInterval(() => { gameTime++; const minutes = Math.floor(gameTime / 60); const seconds = gameTime % 60; document.getElementById('game-time').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`; }, 1000); }
function endGame() { isGameActive = false; clearInterval(gameTimer); const minutes = Math.floor(gameTime / 60); const seconds = gameTime % 60; const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`; document.getElementById('final-time').textContent = timeStr; document.getElementById('final-moves').textContent = moves; document.getElementById('game-result').classList.remove('hidden'); saveGameResult(timeStr, moves); }
async function saveGameResult(time, movesCount) { if (!currentUser) return; try { const userRef = window.doc(window.db, "users", currentUser.uid); const userDoc = await window.getDoc(userRef); if (userDoc.exists()) { const data = userDoc.data(); const gameResults = data.gameResults || []; gameResults.push({ date: new Date(), time, moves: movesCount }); if (gameResults.length > 10) gameResults.splice(0, gameResults.length - 10); await window.setDoc(userRef, { gameResults }, { merge: true }); } } catch (e) { console.error("Ошибка сохранения результата игры:", e); } }
function closeMemoryGame() { isGameActive = false; clearInterval(gameTimer); document.getElementById('memory-game-modal').classList.add('hidden'); }
function restartMemoryGame() { initMemoryGame(); }

// ==================== ПЕРЕКЛЮЧЕНИЕ ТЕМ ====================
function loadTheme() { const savedTheme = localStorage.getItem('theme') || 'dark'; applyTheme(savedTheme); }
function applyTheme(theme) { const body = document.body; const toggleBtn = document.getElementById('theme-toggle'); if (theme === 'light') { body.classList.add('light-theme'); if (toggleBtn) toggleBtn.textContent = '☀️ Светлая'; } else { body.classList.remove('light-theme'); if (toggleBtn) toggleBtn.textContent = '🌙 Тёмная'; } localStorage.setItem('theme', theme); }
function toggleTheme() { const body = document.body; const isLight = body.classList.contains('light-theme'); applyTheme(isLight ? 'dark' : 'light'); }