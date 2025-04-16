// firebase-login.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  updateDoc,
  getDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyD3a_iY2bCi1PCbMVpxd-bkBzQe85omBRM",
  authDomain: "mytaskmanager-2388a.firebaseapp.com",
  projectId: "mytaskmanager-2388a",
  storageBucket: "mytaskmanager-2388a.firebasestorage.app",
  messagingSenderId: "402291107920",
  appId: "1:402291107920:web:25a58f3897e38830fcc955"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore(app);

// Login
document.getElementById("loginBtn")?.addEventListener("click", () => {
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;
  signInWithEmailAndPassword(auth, email, pass)
    .then(() => window.location.href = "board.html")
    .catch(err => alert("Login failed: " + err.message));
});

// Logout
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  signOut(auth).then(() => window.location.href = "index.html");
});

// Auth state check
onAuthStateChanged(auth, async user => {
  if (!user && window.location.pathname.includes("board.html")) {
    window.location.href = "index.html";
  }

  // Save user profile in Firestore
  if (user) {
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email
    }, { merge: true });
  }
});

// ---------- board.html specific ----------
if (window.location.pathname.includes("board.html")) {
  document.getElementById("createBoardBtn")?.addEventListener("click", async () => {
    const boardName = document.getElementById("boardName").value.trim();
    if (!boardName) return alert("Board name cannot be empty");

    const user = auth.currentUser;
    if (!user) return alert("Not logged in!");

    await addDoc(collection(db, "taskboards"), {
      name: boardName,
      owner: user.uid,
      members: [user.uid],
      createdAt: serverTimestamp()
    });

    alert("Board created!");
    document.getElementById("boardName").value = "";
  });

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const q = query(collection(db, "taskboards"), where("members", "array-contains", user.uid));
      const querySnapshot = await getDocs(q);
      const boardList = document.getElementById("boardList");
      boardList.innerHTML = "<h3>Your Boards:</h3>";

      querySnapshot.forEach(doc => {
        const data = doc.data();
        const div = document.createElement("div");
        div.innerHTML = `<button onclick="goToBoard('${doc.id}')">${data.name}</button>`;
        boardList.appendChild(div);
      });
    }
  });

  window.goToBoard = function (boardId) {
    window.location.href = `taskboard.html?boardId=${boardId}`;
  };
}

// ---------- taskboard.html specific ----------
if (window.location.pathname.includes("taskboard.html")) {
  const urlParams = new URLSearchParams(window.location.search);
  const boardId = urlParams.get("boardId");

  onAuthStateChanged(auth, async (user) => {
    if (user && boardId) {
      const boardRef = doc(db, "taskboards", boardId);
      const boardSnap = await getDoc(boardRef);

      if (!boardSnap.exists()) {
        alert("Board not found");
        return;
      }

      const board = boardSnap.data();
      document.getElementById("boardInfo").innerText = `Board Name: ${board.name}`;

      if (board.owner === user.uid) {
        document.getElementById("addUserBtn")?.addEventListener("click", async () => {
          const email = document.getElementById("userEmail").value.trim();
          if (!email) return;

          const usersQuery = query(collection(db, "users"), where("email", "==", email));
          const userDocs = await getDocs(usersQuery);

          if (userDocs.empty) {
            document.getElementById("addUserMsg").innerText = "User not found.";
            return;
          }

          const userToAdd = userDocs.docs[0].data().uid;

          if (board.members.includes(userToAdd)) {
            document.getElementById("addUserMsg").innerText = "User already a member.";
            return;
          }

          await updateDoc(boardRef, {
            members: [...board.members, userToAdd]
          });

          // Assign them to unassigned tasks if needed in future
          document.getElementById("addUserMsg").innerText = "User added successfully!";
        });

        //  Rename Board Feature 
        const renameBtn = document.createElement("button");
        renameBtn.textContent = "Rename Board";
        renameBtn.style.marginLeft = "15px";
        renameBtn.addEventListener("click", async () => {
          const newName = prompt("Enter new board name:", board.name);
          if (newName && newName.trim()) {
            await updateDoc(boardRef, { name: newName.trim() });
            document.getElementById("boardInfo").innerText = `Board Name: ${newName.trim()}`;
            alert("Board renamed!");
          }
        });
        document.getElementById("boardInfo").appendChild(renameBtn);

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete Board";
        deleteBtn.style.marginLeft = "10px";
        deleteBtn.addEventListener("click", async () => {
          const tasksRef = collection(db, "taskboards", boardId, "tasks");
          const tasksSnap = await getDocs(tasksRef);
          if (!tasksSnap.empty) {
            alert("Cannot delete board with tasks. Delete all tasks first.");
            return;
          }

          if (board.members.length > 1) {
            alert("Cannot delete board with other members. Remove them first.");
            return;
          }

          const confirmDelete = confirm("Are you sure you want to delete this board?");
          if (!confirmDelete) return;

          await deleteDoc(doc(db, "taskboards", boardId));
          alert("Board deleted!");
          window.location.href = "board.html";
        });
        document.getElementById("boardInfo").appendChild(deleteBtn);
      } else {
        document.getElementById("addUserBtn").style.display = "none";
        document.getElementById("userEmail").style.display = "none";
      }

      document.getElementById("addTaskBtn")?.addEventListener("click", async () => {
        const taskTitle = document.getElementById("taskTitle").value.trim();
        const dueDate = document.getElementById("dueDate").value;

        if (!taskTitle || !dueDate) {
          alert("Please enter both task title and due date.");
          return;
        }

        const taskRef = collection(db, "taskboards", boardId, "tasks");
        await addDoc(taskRef, {
          title: taskTitle,
          dueDate: dueDate,
          completed: false,
          createdAt: serverTimestamp()
        });

        alert("Task added!");
        document.getElementById("taskTitle").value = "";
        document.getElementById("dueDate").value = "";

        loadTasks();

        document.getElementById("taskStats").innerText =
          `Total: ${total} | Completed: ${completed} | Active: ${active}`;
      });

      async function loadTasks() {
        const taskList = document.getElementById("taskList");
        taskList.innerHTML = "";

let total = 0;
let completed = 0;
let active = 0;

        const tasksQuery = collection(db, "taskboards", boardId, "tasks");
        const snapshot = await getDocs(tasksQuery);

        snapshot.forEach(taskDoc => {
          const task = taskDoc.data();
          const taskId = taskDoc.id;

          const li = document.createElement("li");

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = task.completed || false;
          checkbox.addEventListener("change", async () => {
            const completed = checkbox.checked;
            await updateDoc(doc(db, "taskboards", boardId, "tasks", taskId), {
              completed,
              completedAt: completed ? serverTimestamp() : null
            });
            loadTasks();
          });

          li.appendChild(checkbox);
          li.appendChild(document.createTextNode(` ${task.title} - Due: ${task.dueDate}`));

          if (task.completed && task.completedAt) {
            const completedTime = task.completedAt.toDate?.().toLocaleString?.() || "✓";
            const timeSpan = document.createElement("span");
            timeSpan.style.color = "green";
            timeSpan.innerText = ` — Completed at: ${completedTime}`;
            li.appendChild(timeSpan);
          }

          const editBtn = document.createElement("button");
          editBtn.textContent = "Edit";
          editBtn.style.marginLeft = "10px";
          editBtn.addEventListener("click", async () => {
            const newTitle = prompt("Enter new title:", task.title);
            const newDue = prompt("Enter new due date (YYYY-MM-DD):", task.dueDate);
            if (newTitle && newDue) {
              await updateDoc(doc(db, "taskboards", boardId, "tasks", taskId), {
  title: newTitle,
  dueDate: newDue,
  highlight: false // remove red highlight if reassigned
});
              loadTasks();
            }
          });
          li.appendChild(editBtn);

          const delBtn = document.createElement("button");
          delBtn.textContent = "Delete";
          delBtn.style.marginLeft = "5px";
          delBtn.addEventListener("click", async () => {
            const confirmDelete = confirm("Are you sure you want to delete this task?");
            if (confirmDelete) {
              await updateDoc(doc(db, "taskboards", boardId, "tasks", taskId), {
                deleted: true
              });
              await deleteDoc(doc(db, "taskboards", boardId, "tasks", taskId));
              loadTasks();
            }
          });
          li.appendChild(delBtn);

          total++;
if (task.completed) completed++;
else active++;

          taskList.appendChild(li);
        });
      }

      loadTasks();
    }
  });
}
