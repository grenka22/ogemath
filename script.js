let currentUser = null;
let currentUsername = null;
let currentTaskId = null;
let hintTimers = {};
let currentTopicFilter = "all";

// ==================== ДАННЫЕ ====================

let theoryData = [];
let practiceData = [];

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
// 🎨 Загружаем сохранённую тему!
  loadTheme();

  // Загружаем данные из Firebase
  await loadTheoryFromFirebase();
  await loadPracticeFromFirebase();

  // Загружаем данные из Firebase
  await loadTheoryFromFirebase();
  await loadPracticeFromFirebase();

 window.onAuthStateChanged(window.auth, async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('register-screen')?.classList.add('hidden');
    document.getElementById('main-menu')?.classList.remove('hidden');
    
    document.getElementById('user-name').textContent = currentUsername || user.email.split('@')[0];
    await loadUserData();
    
    // 🎮 Показываем игру на память при входе!
    showMemoryGame();
    checkChatAccess();
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
});

// ==================== ЗАГРУЗКА ДАННЫХ ИЗ FIREBASE ====================

async function loadTheoryFromFirebase() {
  try {
    const snapshot = await window.getDocs(window.collection(window.db, "theory"));
    theoryData = [];
    if (!snapshot.empty) {
      snapshot.forEach(doc => {
        theoryData.push({ id: doc.id, ...doc.data() });
      });
    }
    console.log("📚 Теория загружена:", theoryData.length);
  } catch (e) {
    console.error("❌ Ошибка загрузки теории:", e);
    theoryData = [];
  }
}


async function loadPracticeFromFirebase() {
  try {
    const snapshot = await window.getDocs(window.collection(window.db, "tasks"));
    practiceData = [];
    if (!snapshot.empty) {
      snapshot.forEach(doc => {
        practiceData.push({ id: parseInt(doc.id), ...doc.data() });
      });
    }
    console.log("✏️ Практика загружена:", practiceData.length);
  } catch (e) {
    console.error("❌ Ошибка загрузки практики:", e);
    practiceData = [];
  }
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

// ==================== НАВИГАЦИЯ ====================

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(screenId)?.classList.remove('hidden');
  
  if (screenId === 'theory-screen') showTheoryList();
  if (screenId === 'practice-screen') showTopicSelection();
  if (screenId === 'profile-screen') loadProfileStats();
}

// ==================== АВТОРИЗАЦИЯ ====================

async function register() {
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;
  const confirm = document.getElementById('register-password-confirm').value;
  
  if (!username || !password) {
    document.getElementById('register-error').textContent = 'Введите имя и пароль!';
    return;
  }
  if (password !== confirm) {
    document.getElementById('register-error').textContent = 'Пароли не совпадают!';
    return;
  }
  if (password.length < 6) {
    document.getElementById('register-error').textContent = 'Пароль минимум 6 символов!';
    return;
  }
  
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
  
  if (!username || !password) {
    document.getElementById('login-error').textContent = 'Введите имя и пароль!';
    return;
  }
  
  try {
    const fakeEmail = username.toLowerCase().replace(/\s/g, '') + '@oge.local';
    currentUsername = username;
    await window.signInWithEmailAndPassword(window.auth, fakeEmail, password);
  } catch (e) {
    document.getElementById('login-error').textContent = 'Неверное имя или пароль!';
  }
}

async function logout() {
  await window.signOut(window.auth);
  currentUsername = null;
}

async function loadUserData() {
  if (!currentUser) return;
  
  const doc = await window.getDoc(window.doc(window.db, "users", currentUser.uid));
  if (doc.exists()) {
    const data = doc.data();
    
    // 🔐 Показываем/скрываем кнопку админки
    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) {
      if (data.isAdmin === true) {
        adminBtn.classList.remove('hidden');
      } else {
        adminBtn.classList.add('hidden');
      }
    }
    
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
  list.innerHTML = theoryData.map(t => `
    <div class="theory-topic">
      <h3>${t.number}: ${t.title}</h3>
      <button onclick="showTheoryDetail(${t.id})">Открыть</button>
    </div>
  `).join('');
}

function showTheoryDetail(id) {
  const topic = theoryData.find(t => t.id == id);
  if (!topic) return;
  document.getElementById('theory-list').innerHTML = `
    <button onclick="showTheoryList()" class="back-btn">← Назад</button>
    <div class="theory-detail">
      <h2>${topic.number}: ${topic.title}</h2>
      <div class="theory-content">${topic.content}</div>
    </div>
  `;
}

// ==================== ПРАКТИКА ====================

function getTasksForCurrentTopic() {
  return currentTopicFilter === "all" ? practiceData : practiceData.filter(t => t.topic === currentTopicFilter);
}

function showTopicSelection() {
  document.getElementById('topic-selection')?.classList.remove('hidden');
  document.getElementById('task-container')?.classList.add('hidden');
  initTopics();
}

function startTopicPractice(topicId) {
  currentTopicFilter = topicId;
  document.getElementById('topic-selection')?.classList.add('hidden');
  document.getElementById('task-container')?.classList.remove('hidden');
  loadTaskForIndex(1);
}

function loadTaskForIndex(index) {
  const tasks = getTasksForCurrentTopic();
  if (index < 1) index = tasks.length;
  if (index > tasks.length) index = 1;
  
  const task = tasks[index - 1];
  if (!task) return;
  
  currentTaskId = task.id;
  
  document.getElementById('task-number').textContent = task.number;
  document.getElementById('task-text').textContent = task.question;
  document.getElementById('user-answer').value = '';
  document.getElementById('result-message').innerHTML = '';
  document.getElementById('task-counter').textContent = `Задача ${index} из ${tasks.length}`;
  
  // Очистка старого изображения
  const oldImg = document.getElementById('task-image-display');
  if (oldImg) oldImg.remove();
  
  // Добавление нового изображения
  if (task.imageUrl && task.imageUrl.trim() !== '' && task.imageUrl.startsWith('http')) {
    const imgContainer = document.createElement('div');
    imgContainer.id = 'task-image-display';
    imgContainer.className = 'task-image-display';
    imgContainer.innerHTML = `<img src="${task.imageUrl}" class="task-image" alt="Задание" onerror="this.parentElement.style.display='none'">`;
    
    const taskText = document.getElementById('task-text');
    taskText.parentNode.insertBefore(imgContainer, document.getElementById('user-answer'));
  }
  
  // Сброс подсказок
  document.getElementById('hint-1-text')?.classList.add('hidden');
  document.getElementById('hint-2-text')?.classList.add('hidden');
  const btn1 = document.getElementById('hint-btn-1');
  const btn2 = document.getElementById('hint-btn-2');
  if (btn1) { btn1.disabled = true; btn1.textContent = '💡 Подсказка 1 (через 5 мин)'; }
  if (btn2) { btn2.disabled = true; btn2.textContent = '💡 Подсказка 2 (через 6.5 мин)'; }
  
  // Кнопки навигации
  document.getElementById('prev-btn').style.display = index > 1 ? 'inline-block' : 'none';
  document.getElementById('next-btn').style.display = index < tasks.length ? 'inline-block' : 'none';
  document.getElementById('retry-btn').style.display = index === tasks.length ? 'inline-block' : 'none';
  
  // Таймеры подсказок
  if (hintTimers[task.id]) {
    clearTimeout(hintTimers[task.id].hint1);
    clearTimeout(hintTimers[task.id].hint2);
  }
  startHintTimersFast(task.id);
}

function startHintTimersFast(taskId) {
  hintTimers[taskId] = {
    hint1: setTimeout(() => {
      const btn = document.getElementById('hint-btn-1');
      if (btn) { btn.disabled = false; btn.textContent = '💡 Подсказка 1 (доступна!)'; }
    }, 50000),
    hint2: setTimeout(() => {
      const btn = document.getElementById('hint-btn-2');
      if (btn) { btn.disabled = false; btn.textContent = '💡 Подсказка 2 (доступна!)'; }
    }, 65000)
  };
}

function showHint(num) {
  const task = practiceData.find(t => t.id === currentTaskId);
  if (!task) return;
  if (num === 1) {
    const el = document.getElementById('hint-1-text');
    if (el) { el.textContent = task.hint1; el.classList.remove('hidden'); }
    const btn = document.getElementById('hint-btn-1');
    if (btn) btn.disabled = true;
  } else if (num === 2) {
    const el = document.getElementById('hint-2-text');
    if (el) { el.textContent = task.hint2; el.classList.remove('hidden'); }
    const btn = document.getElementById('hint-btn-2');
    if (btn) btn.disabled = true;
  }
}

function previousTask() {
  const tasks = getTasksForCurrentTopic();
  const idx = tasks.findIndex(t => t.id === currentTaskId);
  if (idx > 0) loadTaskForIndex(idx);
}

function nextTask() {
  const tasks = getTasksForCurrentTopic();
  const idx = tasks.findIndex(t => t.id === currentTaskId);
  loadTaskForIndex(idx + 2);
}

function solveAgain() {
  loadTaskForIndex(1);
}

async function checkAnswer() {
  const task = practiceData.find(t => t.id === currentTaskId);
  if (!task) return;
  
  const userAns = document.getElementById('user-answer').value.trim().toLowerCase();
  const correct = task.correctAnswer.toString().toLowerCase();
  const result = document.getElementById('result-message');
  
  if (userAns === correct) {
    result.innerHTML = '<p class="success">✅ Правильно! Молодец!</p>';
    await saveProgress(task.id, true);
    
    const tasks = getTasksForCurrentTopic();
    const idx = tasks.findIndex(t => t.id === currentTaskId);
    const isLast = idx === tasks.length - 1;
    
    result.innerHTML += `<div class="nav-buttons">
      ${!isLast ? '<button onclick="nextTask()" class="nav-btn next">Следующая →</button>' : ''}
      <button onclick="solveAgain()" class="nav-btn retry">🔄 Ещё раз</button>
    </div>`;
  } else {
    result.innerHTML = `
      <p class="error">❌ Неправильно!</p>
      <div class="explanation-box">
        <p><strong>Объяснение:</strong> ${task.explanation}</p>
        <button onclick="toggleSimpleExplanation()">Объяснить проще</button>
        <p id="simple-explanation" class="hidden"><strong>Проще:</strong> ${task.simpleExplanation}</p>
      </div>
      <div class="nav-buttons"><button onclick="solveAgain()" class="nav-btn retry">🔄 Ещё раз</button></div>
    `;
    await saveProgress(task.id, false);
  }
}

function toggleSimpleExplanation() {
  document.getElementById('simple-explanation')?.classList.toggle('hidden');
}

async function saveProgress(taskId, isCorrect) {
  if (!currentUser) return;
  const ref = window.doc(window.db, "users", currentUser.uid);
  const doc = await window.getDoc(ref);
  if (doc.exists()) {
    const data = doc.data();
    const progress = data.progress || {};
    const mistakes = data.mistakes || [];
    
    if (isCorrect) progress[taskId] = { completed: true, completedAt: new Date() };
    else mistakes.push({ taskId, attemptedAt: new Date() });
    
    await window.setDoc(ref, { progress, mistakes }, { merge: true });
    updateProgress(progress);
  }
}

async function loadProfileStats() {
  if (!currentUser) return;
  const container = document.getElementById('profile-stats');
  if (!container) return;
  
  const doc = await window.getDoc(window.doc(window.db, "users", currentUser.uid));
  if (doc.exists()) {
    const data = doc.data();
    const progress = data.progress || {};
    const mistakes = data.mistakes || [];
    const done = Object.keys(progress).length;
    const total = practiceData.length;
    
    const byTask = {};
    mistakes.forEach(m => byTask[m.taskId] = (byTask[m.taskId] || 0) + 1);
    
    let errs = '';
    for (const [id, cnt] of Object.entries(byTask)) {
      const t = practiceData.find(x => x.id == id);
      if (t) errs += `<li>Задание №${t.number}: ${cnt} ошиб.</li>`;
    }
    
    container.innerHTML = `
      <div class="stat-card">
        <h3>📊 Статистика</h3>
        <p>Выполнено: <strong>${done} из ${total}</strong></p>
        <p>Процент: <strong>${Math.round((done/total)*100)}%</strong></p>
        <p>Ошибок: <strong>${mistakes.length}</strong></p>
      </div>
      <div class="stat-card">
        <h3>❌ Ошибки</h3>
        ${errs ? '<ul>'+errs+'</ul>' : '<p>Ошибок нет! 🎉</p>'}
      </div>
    `;
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
  else if (tabName === 'theory') loadTheoryAdmin();
}

async function loadAllUsers() {
  const list = document.getElementById('users-list');
  if (!list) return;
  list.innerHTML = '<p>Загрузка...</p>';
  
  try {
    const snap = await window.getDocs(window.collection(window.db, "users"));
    if (snap.empty) { list.innerHTML = '<p>Пользователей нет</p>'; return; }
    
    list.innerHTML = Array.from(snap.docs).map(d => {
      const data = d.data();
      const prog = data.progress || {};
      const errs = data.mistakes || [];
      return `
        <div class="user-card">
          <h4>${data.username||'Без имени'} (${data.email||'нет'})</h4>
          <p>Зарегистрирован: ${data.createdAt ? new Date(data.createdAt.seconds*1000).toLocaleDateString() : '?'}</p>
          <p>Выполнено: ${Object.keys(prog).length} | Ошибок: ${errs.length}</p>
          <p>Статус: ${data.isAdmin ? '👑 Админ' : '👤 Ученик'}</p>
        </div>
      `;
    }).join('');
  } catch (e) {
    list.innerHTML = `<p class="error">Ошибка: ${e.message}</p>`;
  }
}

function loadAllTasks() {
  const list = document.getElementById('tasks-list');
  if (!list) return;
  list.innerHTML = practiceData.length === 0 ? '<p>Заданий нет</p>' : practiceData.map((t, i) => `
    <div class="task-card">
      <div class="task-card-header">
        <strong>№${t.number}</strong><span class="task-topic">${t.topicName}</span>
      </div>
      <p class="task-question-preview">${t.question}</p>
      ${t.imageUrl ? `<img src="${t.imageUrl}" style="max-width:100px;border-radius:5px;margin:5px 0;">` : ''}
      <p class="task-answer">Ответ: ${t.correctAnswer}</p>
      <button onclick="editTask(${i})" class="edit-btn">✏️</button>
      <button onclick="deleteTask(${i})" class="delete-btn">🗑</button>
    </div>
  `).join('');
}

async function addNewTask() {
  const number = document.getElementById('new-task-number').value;
  const topic = document.getElementById('new-task-topic').value;
  const question = document.getElementById('new-task-question').value;
  const imageUrl = document.getElementById('new-task-image-url').value.trim();
  const answer = document.getElementById('new-task-answer').value;
  const explanation = document.getElementById('new-task-explanation').value;
  const simple = document.getElementById('new-task-simple').value;
  const hint1 = document.getElementById('new-task-hint1').value;
  const hint2 = document.getElementById('new-task-hint2').value;
  
  if (!number || !answer) {
    document.getElementById('admin-message').textContent = '❌ Заполните обязательные поля!';
    document.getElementById('admin-message').className = 'error-msg';
    return;
  }
  
  const names = { fractions:'Дроби и проценты', powers:'Степени и корни', equations:'Уравнения', geometry:'Геометрия' };
  
  const newTask = {
    id: Date.now(),
    number: parseInt(number),
    topic,
    topicName: names[topic],
    question,
    imageUrl: imageUrl || null,
    correctAnswer: answer,
    explanation,
    simpleExplanation: simple,
    hint1,
    hint2
  };
  
  try {
    await window.setDoc(window.doc(window.db, "tasks", newTask.id.toString()), newTask);
    practiceData.push(newTask);
    
    document.getElementById('admin-message').textContent = '✅ Сохранено!';
    document.getElementById('admin-message').className = 'success-msg';
    
    document.getElementById('new-task-number').value = '';
    document.getElementById('new-task-topic').value = 'fractions';
    document.getElementById('new-task-question').value = '';
    document.getElementById('new-task-image-url').value = '';
    document.getElementById('new-task-answer').value = '';
    document.getElementById('new-task-explanation').value = '';
    document.getElementById('new-task-simple').value = '';
    document.getElementById('new-task-hint1').value = '';
    document.getElementById('new-task-hint2').value = '';
    document.getElementById('image-preview').innerHTML = '';
    
    loadAllTasks();
  } catch (e) {
    document.getElementById('admin-message').textContent = '❌ Ошибка: ' + e.message;
    document.getElementById('admin-message').className = 'error-msg';
  }
}

function editTask(index) {
  const t = practiceData[index];
  if (!t) return;
  showAdminTab('add-task');
  
  document.getElementById('new-task-number').value = t.number;
  document.getElementById('new-task-topic').value = t.topic;
  document.getElementById('new-task-question').value = t.question;
  document.getElementById('new-task-image-url').value = t.imageUrl || '';
  document.getElementById('new-task-answer').value = t.correctAnswer;
  document.getElementById('new-task-explanation').value = t.explanation;
  document.getElementById('new-task-simple').value = t.simpleExplanation;
  document.getElementById('new-task-hint1').value = t.hint1;
  document.getElementById('new-task-hint2').value = t.hint2;
  
  const preview = document.getElementById('image-preview');
  if (preview && t.imageUrl) {
    preview.innerHTML = `<img src="${t.imageUrl}" style="max-width:300px;max-height:200px;border-radius:5px;">`;
  }
  
  const btn = document.querySelector('#admin-add-task .save-btn');
  if (btn) {
    btn.textContent = '🔄 Обновить';
    btn.onclick = () => updateTask(index);
  }
  document.getElementById('admin-message').textContent = '✏️ Редактирование №' + t.number;
}

async function updateTask(index) {
  const names = { fractions:'Дроби и проценты', powers:'Степени и корни', equations:'Уравнения', geometry:'Геометрия' };
  
  practiceData[index] = {
    ...practiceData[index],
    number: parseInt(document.getElementById('new-task-number').value),
    topic: document.getElementById('new-task-topic').value,
    topicName: names[document.getElementById('new-task-topic').value],
    question: document.getElementById('new-task-question').value,
    imageUrl: document.getElementById('new-task-image-url').value.trim() || null,
    correctAnswer: document.getElementById('new-task-answer').value,
    explanation: document.getElementById('new-task-explanation').value,
    simpleExplanation: document.getElementById('new-task-simple').value,
    hint1: document.getElementById('new-task-hint1').value,
    hint2: document.getElementById('new-task-hint2').value
  };
  
  try {
    const t = practiceData[index];
    await window.setDoc(window.doc(window.db, "tasks", t.id.toString()), t);
    document.getElementById('admin-message').textContent = '✅ Обновлено!';
    document.getElementById('admin-message').className = 'success-msg';
    
    const btn = document.querySelector('#admin-add-task .save-btn');
    if (btn) { btn.textContent = '💾 Сохранить'; btn.onclick = addNewTask; }
    
    loadAllTasks();
  } catch (e) {
    document.getElementById('admin-message').textContent = '❌ Ошибка: ' + e.message;
    document.getElementById('admin-message').className = 'error-msg';
  }
}

async function deleteTask(index) {
  if (!confirm('Удалить задание?')) return;
  
  const t = practiceData[index];
  if (!t || !t.id) {
    alert('Ошибка: задание не найдено!');
    return;
  }
  
  try {
    console.log("🗑 Удаляю задание ID:", t.id);
    const taskRef = window.doc(window.db, "tasks", t.id.toString());
    await window.deleteDoc(taskRef);
    
    practiceData.splice(index, 1);
    loadAllTasks();
    console.log("✅ Задание удалено");
  } catch (e) {
    console.error("❌ Ошибка удаления:", e);
    alert('Ошибка: ' + e.message);
  }
}

// ==================== УПРАВЛЕНИЕ ТЕОРИЕЙ ====================

function loadTheoryAdmin() {
  const list = document.getElementById('theory-list-admin');
  if (!list) return;
  list.innerHTML = theoryData.length === 0 ? '<p>Теории нет</p>' : theoryData.map((t, i) => `
    <div class="theory-card">
      <div class="theory-card-header"><strong>${t.number}</strong><span>${t.title}</span></div>
      <button onclick="editTheory(${i})" class="edit-btn">✏️</button>
      <button onclick="deleteTheory(${i})" class="delete-btn">🗑</button>
    </div>
  `).join('');
}

async function saveTheory() {
  const number = document.getElementById('theory-number').value;
  const title = document.getElementById('theory-title').value;
  const content = document.getElementById('theory-content').value;
  const msg = document.getElementById('theory-message');
  
  if (!number || !title || !content) {
    msg.textContent = '❌ Заполните все поля!'; msg.className = 'error-msg'; return;
  }
  
  const newT = { id: Date.now(), number, title, content };
  
  try {
    await window.setDoc(window.doc(window.db, "theory", newT.id.toString()), newT);
    theoryData.push(newT);
    
    msg.textContent = '✅ Сохранено!'; msg.className = 'success-msg';
    document.getElementById('theory-number').value = '';
    document.getElementById('theory-title').value = '';
    document.getElementById('theory-content').value = '';
    
    loadTheoryAdmin();
  } catch (e) {
    console.error("Ошибка:", e);
    msg.textContent = '❌ Ошибка: ' + e.message; msg.className = 'error-msg';
  }
}

function editTheory(index) {
  const t = theoryData[index];
  if (!t) return;
  document.getElementById('theory-number').value = t.number;
  document.getElementById('theory-title').value = t.title;
  document.getElementById('theory-content').value = t.content;
  
  const btn = document.querySelector('#admin-theory .save-btn');
  if (btn) { btn.textContent = '🔄 Обновить'; btn.onclick = () => updateTheory(index); }
  document.getElementById('theory-message').textContent = '✏️ Редактирование';
}

async function updateTheory(index) {
  const t = theoryData[index];
  if (!t) return;
  
  const updated = {
    ...t,
    number: document.getElementById('theory-number').value,
    title: document.getElementById('theory-title').value,
    content: document.getElementById('theory-content').value
  };
  
  try {
    await window.setDoc(window.doc(window.db, "theory", t.id.toString()), updated);
    theoryData[index] = updated;
    
    const msg = document.getElementById('theory-message');
    msg.textContent = '✅ Обновлено!'; msg.className = 'success-msg';
    
    const btn = document.querySelector('#admin-theory .save-btn');
    if (btn) { btn.textContent = '💾 Сохранить'; btn.onclick = saveTheory; }
    
    loadTheoryAdmin();
  } catch (e) {
    console.error("Ошибка:", e);
    document.getElementById('theory-message').textContent = '❌ Ошибка: ' + e.message;
  }
}

async function deleteTheory(index) {
  if (!confirm('Удалить теорию?')) return;
  
  const t = theoryData[index];
  if (!t || !t.id) {
    alert('Ошибка: теория не найдена!');
    return;
  }
  
  try {
    console.log("🗑 Удаляю теорию ID:", t.id);
    const theoryRef = window.doc(window.db, "theory", t.id.toString());
    await window.deleteDoc(theoryRef);
    
    theoryData.splice(index, 1);
    loadTheoryAdmin();
    console.log("✅ Теория удалена");
  } catch (e) {
    console.error("❌ Ошибка удаления:", e);
    alert('Ошибка: ' + e.message);
  }

}

// ==================== ИГРА НА ПАМЯТЬ ====================

let gameCards = [];
let flippedCards = [];
let matchedPairs = 0;
let moves = 0;
let gameTimer = null;
let gameTime = 0;
let isGameActive = false;

// Данные для игры (формулы и правила ОГЭ)
const memoryGameData = [
  { id: 1, question: "Площадь круга", answer: "S = πr²" },
  { id: 2, question: "Сумма углов треугольника", answer: "180°" },
  { id: 3, question: "Квадрат суммы", answer: "(a+b)² = a²+2ab+b²" },
  { id: 4, question: "Дискриминант", answer: "D = b²-4ac" },
  { id: 5, question: "Теорема Пифагора", answer: "a²+b²=c²" },
  { id: 6, question: "Процент от числа", answer: "число × % ÷ 100" },
  { id: 7, question: "Длина окружности", answer: "C = 2πr" },
  { id: 8, question: "Корень из произведения", answer: "√(ab) = √a × √b" }
];

// Показываем игру при входе (кроме админов)
async function showMemoryGame() {
  if (!currentUser) return;
  
  // Проверяем, админ ли пользователь
  const userDoc = await window.getDoc(window.doc(window.db, "users", currentUser.uid));
  if (userDoc.exists() && userDoc.data().isAdmin) {
    return; // Админам не показываем игру
  }
  
  // Показываем модальное окно
  document.getElementById('memory-game-modal').classList.remove('hidden');
  
  // Инициализируем игру
  initMemoryGame();
}

// Инициализация игры
function initMemoryGame() {
  // Сброс переменных
  flippedCards = [];
  matchedPairs = 0;
  moves = 0;
  gameTime = 0;
  isGameActive = true;
  
  // Обновляем статистику
  document.getElementById('game-moves').textContent = '0';
  document.getElementById('game-time').textContent = '0:00';
  document.getElementById('game-pairs').textContent = '0/8';
  document.getElementById('game-result').classList.add('hidden');
  
  // Создаём карточки (вопрос + ответ для каждой пары)
  const cards = [];
  memoryGameData.forEach(item => {
    cards.push({ id: item.id, content: item.question, type: 'question' });
    cards.push({ id: item.id, content: item.answer, type: 'answer' });
  });
  
  // Перемешиваем
  shuffleArray(cards);
  
  // Генерируем HTML
  const board = document.getElementById('game-board');
  board.innerHTML = '';
  
  cards.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'game-card';
    cardEl.dataset.id = card.id;
    cardEl.dataset.index = index;
    cardEl.innerHTML = `
      <div class="game-card-inner">
        <div class="game-card-front">?</div>
        <div class="game-card-back">${card.content}</div>
      </div>
    `;
    cardEl.onclick = () => flipCard(cardEl);
    board.appendChild(cardEl);
  });
  
  // Запускаем таймер
  startGameTimer();
}

// Перемешивание массива (алгоритм Фишера-Йетса)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Переворот карточки
function flipCard(cardEl) {
  if (!isGameActive) return;
  if (cardEl.classList.contains('flipped')) return;
  if (cardEl.classList.contains('matched')) return;
  if (flippedCards.length >= 2) return;
  
  cardEl.classList.add('flipped');
  flippedCards.push(cardEl);
  
  if (flippedCards.length === 2) {
    moves++;
    document.getElementById('game-moves').textContent = moves;
    
    checkMatch();
  }
}

// Проверка совпадения
function checkMatch() {
  const [card1, card2] = flippedCards;
  const match = card1.dataset.id === card2.dataset.id;
  
  if (match) {
    // Совпадение!
    card1.classList.add('matched');
    card2.classList.add('matched');
    matchedPairs++;
    document.getElementById('game-pairs').textContent = `${matchedPairs}/8`;
    
    flippedCards = [];
    
    // Проверка победы
    if (matchedPairs === 8) {
      endGame();
    }
  } else {
    // Нет совпадения
    setTimeout(() => {
      card1.classList.remove('flipped');
      card2.classList.remove('flipped');
      flippedCards = [];
    }, 1000);
  }
}

// Запуск таймера
function startGameTimer() {
  if (gameTimer) clearInterval(gameTimer);
  
  gameTimer = setInterval(() => {
    gameTime++;
    const minutes = Math.floor(gameTime / 60);
    const seconds = gameTime % 60;
    document.getElementById('game-time').textContent = 
      `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, 1000);
}

// Конец игры
function endGame() {
  isGameActive = false;
  clearInterval(gameTimer);
  
  const minutes = Math.floor(gameTime / 60);
  const seconds = gameTime % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  document.getElementById('final-time').textContent = timeStr;
  document.getElementById('final-moves').textContent = moves;
  document.getElementById('game-result').classList.remove('hidden');
  
  // Сохраняем результат
  saveGameResult(timeStr, moves);
}

// Сохранение результата игры
async function saveGameResult(time, movesCount) {
  if (!currentUser) return;
  
  try {
    const userRef = window.doc(window.db, "users", currentUser.uid);
    const userDoc = await window.getDoc(userRef);
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      const gameResults = data.gameResults || [];
      
      gameResults.push({
        date: new Date(),
        time: time,
        moves: movesCount
      });
      
      // Храним последние 10 результатов
      if (gameResults.length > 10) {
        gameResults.splice(0, gameResults.length - 10);
      }
      
      await window.setDoc(userRef, { gameResults }, { merge: true });
    }
  } catch (e) {
    console.error("Ошибка сохранения результата игры:", e);
  }
}

// Закрыть игру
function closeMemoryGame() {
  isGameActive = false;
  clearInterval(gameTimer);
  document.getElementById('memory-game-modal').classList.add('hidden');
}

// Перезапуск игры
function restartMemoryGame() {
  initMemoryGame();
}

// Обновить onAuthStateChanged для показа игры
// Найди в коде window.onAuthStateChanged и добавь вызов showMemoryGame():

// ==================== ПЕРЕКЛЮЧЕНИЕ ТЕМ ====================

// Загрузка сохранённой темы
function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  applyTheme(savedTheme);
}

// Применение темы
function applyTheme(theme) {
  const body = document.body;
  const toggleBtn = document.getElementById('theme-toggle');
  
  if (theme === 'light') {
    body.classList.add('light-theme');
    if (toggleBtn) toggleBtn.textContent = '☀️ Светлая';
  } else {
    body.classList.remove('light-theme');
    if (toggleBtn) toggleBtn.textContent = '🌙 Тёмная';
  }
  
  localStorage.setItem('theme', theme);
}

// Переключение темы
function toggleTheme() {
  const body = document.body;
  const isLight = body.classList.contains('light-theme');
  const newTheme = isLight ? 'dark' : 'light';
  applyTheme(newTheme);
}

// Вызываем загрузку темы при старте
// Добавь это в window.addEventListener('DOMContentLoaded', ...)

// ==================== ЧАТ ====================

let chatListener = null;
let currentChatUser = null;

// Проверка доступа к чату
async function checkChatAccess() {
  if (!currentUser) return;
  
  const chatBtn = document.getElementById('chat-btn');
  if (!chatBtn) return;
  
  try {
    const userDoc = await window.getDoc(window.doc(window.db, "users", currentUser.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      
      // Показываем кнопку если: админ ИЛИ есть доступ
      if (data.isAdmin === true || data.hasChatAccess === true) {
        chatBtn.classList.remove('hidden');
        
        // Если админ — показываем дополнительные секции
        if (data.isAdmin === true) {
          document.getElementById('admin-chat-section')?.classList.remove('hidden');
          document.getElementById('admin-chat-manage')?.classList.remove('hidden');
          loadUsersForChat();
        }
      } else {
        chatBtn.classList.add('hidden');
      }
    }
  } catch (e) {
    console.error("Ошибка проверки доступа к чату:", e);
  }
}

// Показать/скрыть чат
function toggleChat() {
  const panel = document.getElementById('chat-panel');
  if (!panel) return;
  
  if (panel.classList.contains('hidden')) {
    panel.classList.remove('hidden');
    loadChatMessages();
  } else {
    panel.classList.add('hidden');
    if (chatListener) {
      chatListener();
      chatListener = null;
    }
  }
}

// Загрузка пользователей для админа
async function loadUsersForChat() {
  const select = document.getElementById('chat-user-select');
  const list = document.getElementById('users-access-list');
  if (!select) return;
  
  try {
    const snapshot = await window.getDocs(window.collection(window.db, "users"));
    select.innerHTML = '<option value="">Выберите пользователя...</option>';
    if (list) list.innerHTML = '';
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (doc.id === currentUser.uid) return; // не показываем себя
      
      // Добавляем в список для чата
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = `${data.username || data.email} ${data.hasChatAccess ? '✅' : ''}`;
      select.appendChild(option);
      
      // Добавляем в список управления доступом (для админа)
      if (list) {
        const item = document.createElement('div');
        item.className = 'user-access-item';
        item.style.cssText = 'display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #333;';
        item.innerHTML = `
          <span style="color: #e0e0e0;">${data.username || data.email}</span>
          <button class="${data.hasChatAccess ? 'revoke-btn' : 'grant-btn'}" 
                  onclick="toggleChatAccess('${doc.id}', ${data.hasChatAccess})"
                  style="padding: 5px 10px; border: none; border-radius: 5px; cursor: pointer; font-size: 12px; background: ${data.hasChatAccess ? '#ff4444' : '#00ff88'}; color: ${data.hasChatAccess ? 'white' : '#0a0a0a'};">
            ${data.hasChatAccess ? '❌ Забрать' : '✅ Дать'}
          </button>
        `;
        list.appendChild(item);
      }
    });
    
    // Обработчик выбора пользователя
    select.onchange = (e) => {
      currentChatUser = e.target.value;
      loadChatMessages();
    };
    
  } catch (e) {
    console.error("Ошибка загрузки пользователей:", e);
  }
}

// Выдать/забрать доступ к чату
async function toggleChatAccess(userId, currentlyHas) {
  try {
    await window.setDoc(window.doc(window.db, "users", userId), {
      hasChatAccess: !currentlyHas
    }, { merge: true });
    
    loadUsersForChat(); // обновить список
  } catch (e) {
    alert("Ошибка: " + e.message);
  }
}

// Загрузка сообщений
function loadChatMessages() {
  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;
  
  // Определяем с кем чатимся (для админа — выбранный пользователь, для обычного — админ)
  const chatWith = currentChatUser || 'admin';
  
  // Отписываемся от предыдущего слушателя
  if (chatListener) {
    chatListener();
  }
  
  // Подписываемся на сообщения
  const q = window.collection(window.db, "messages");
  chatListener = window.onSnapshot(q, (snapshot) => {
    const messages = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      // Показываем только сообщения между текущим юзером и собеседником
      if ((data.from === currentUser.uid && data.to === chatWith) ||
          (data.from === chatWith && data.to === currentUser.uid)) {
        messages.push({ id: doc.id, ...data });
      }
    });
    
    // Сортируем по времени
    messages.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
    
    // Отображаем
    renderMessages(messages);
  });
}

// Отображение сообщений
function renderMessages(messages) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  
  const chatWith = currentChatUser || 'admin';
  
  container.innerHTML = messages.map(msg => {
    const isMine = msg.from === currentUser.uid;
    const time = msg.timestamp?.seconds ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString() : '';
    
    return `
      <div class="chat-message ${isMine ? 'mine' : 'other'}">
        ${msg.text}
        <span class="time">${time}</span>
      </div>
    `;
  }).join('');
  
  // Прокрутка вниз
  container.scrollTop = container.scrollHeight;
}

// Отправка сообщения
async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  
  try {
    const chatWith = currentChatUser || 'admin';
    
    await window.setDoc(window.doc(window.collection(window.db, "messages")), {
      from: currentUser.uid,
      to: chatWith,
      text: text,
      timestamp: new Date(),
      read: false
    });
    
    input.value = '';
  } catch (e) {
    alert("Ошибка отправки: " + e.message);
  }
}

// Отправка по Enter
document.addEventListener('DOMContentLoaded', () => {
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendChatMessage();
      }
    });
  }
});