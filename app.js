const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const port = 8080;
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { MongoClient, ObjectId } = require("mongodb");
const MongoStore = require("connect-mongo");
const middleware = require("./middleware");
require("dotenv").config();

const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME;
let db;

MongoClient.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then((client) => {
    console.log("Connected to MongoDB");
    db = client.db(dbName);
  })
  .catch((error) => console.error(error));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: mongoUri,
      dbName: dbName,
      collectionName: "sessions",
    }),
  })
);

app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");
app.use(bodyParser.json());
app.use(express.static("src"));
app.use(bodyParser.urlencoded({ extended: true }));

// routes
app.get("/", middleware.validateIndexQuery, (req, res) => {
  const message = req.query.message;
  console.log(message);
  if (req.session.userId) {
    res.redirect("/main");
  } else {
    res.render("index", { status: message ? message : "" });
  }
});

app.get("/main", middleware.requireAuth, (req, res) => {
  const username = req.session.userName;
  res.render("main", { username });
});

app.get("/login", middleware.checkAuth, (req, res) => {
  res.render("login", { error: "" });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await db
      .collection("tblaccounts")
      .findOne({ accountUsername: username });
    console.log(user);
    if (user && (await bcrypt.compare(password, user.accountPassword))) {
      req.session.userId = user._id;
      req.session.userName = user.accountUsername;
      res.redirect("/");
    } else {
      res.status(400).render("login", {
        error: "Username and password does not match or exist.",
      });
      return;
    }
  } catch (error) {
    res.status(500).send("Error logging in user");
  }
});

app.get("/register", (req, res) => {
  res.render("register", { error: "" });
});

app.post(
  "/register",
  [middleware.checkAuth, middleware.validateAccountInputs],
  async (req, res) => {
    try {
      const hashedPassword = await middleware.hashPassword(req.body.password);
      const user = await db.collection("tblaccounts").findOne({
        $or: [
          { accountUsername: req.body.username },
          { accountEmail: req.body.email },
        ],
      });

      if (user) {
        res.status(400).render("register", {
          error: "Username / Email already exists.",
        });
        return;
      }

      await db.collection("tblaccounts").insertOne({
        accountUsername: req.body.username,
        accountPassword: hashedPassword,
        accountEmail: req.body.email,
      });

      const payloadData = { message: "Registered successfully" };
      const queryParams = new URLSearchParams(payloadData).toString();
      res.redirect(`/?${queryParams}`);
    } catch (error) {
      console.error(error);
      res.status(400).render("register", { error: "Error" });
    }
  }
);

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log("Failed to destroy session:", err);
      res.status(500).send("Failed to destroy session");
    } else {
      console.log("Session destroyed successfully");
      res.redirect("/");
    }
  });
});

// API
app.post(
  "/api/tasks/update",
  middleware.validateTasksUpdate,
  async (req, res) => {
    if (validataUser(req) === 0) {
      res.status(400).send("Invalid user id and user name");
      return;
    }

    try {
      await db.collection("tbltasks").updateOne(
        {
          _id: new ObjectId(req.body.taskId),
          accountsId: req.session.userId,
        },
        { $set: { taskProgress: parseInt(req.body.taskProgress, 10) } }
      );
      res.json({ status: "success" });
    } catch (error) {
      console.error(error);
      res.status(500).send("Error updating task");
    }
  }
);

app.get(
  "/api/tasks/:projectName",
  middleware.validateGetTasks,
  async (req, res) => {
    if (validataUser(req) === 0) {
      res.status(400).send("Invalid user id and user name");
      return;
    }
    updateProgress();

    const sortOption = req.query.sort;
    let sortBy = req.query.sortBy;
    if (sortBy.startsWith("svg")) {
      switch (sortBy) {
        case "svg-desc":
          sortBy = "taskDescription";
          break;
        case "svg-status":
          sortBy = "taskProgress";
          break;
        case "svg-due":
          sortBy = "taskDue";
          break;
        case "svg-prio":
          sortBy = "taskPriority";
          break;
        default:
          sortBy = "taskName";
          break;
      }
    }

    let projectName = req.params.projectName;
    projectName !== 0 ? console.log("proj", projectName) : null;

    let baseMatchStage;
    if (projectName === "0")
      baseMatchStage = [
        {
          $lookup: {
            from: "tblsharedtables",
            let: { taskId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$$taskId", "$taskId"] },
                },
              },
            ],
            as: "shared",
          },
        },
        {
          $match: {
            shared: { $ne: [] },
          },
        },
      ];
    else
      baseMatchStage = [
        {
          $match: {
            accountsId: req.session.userId,
            taskProject: projectName,
          },
        },
      ];

    let currentDate = new Date().toISOString().split("T")[0];

    let matchOtherStage = {
      $match: {
        $expr: {
          $ne: [{ $substr: ["$taskDue", 0, 10] }, currentDate],
        },
      },
    };

    let matchTodayStage = {
      $match: {
        $expr: {
          $eq: [{ $substr: ["$taskDue", 0, 10] }, currentDate],
        },
      },
    };

    let sortStage = {
      $sort: { [sortBy]: sortOption === "desc" ? -1 : 1 },
    };
    console.log(baseMatchStage);

    try {
      const [resultsOther, resultsToday] = await Promise.all([
        db
          .collection("tbltasks")
          .aggregate([...baseMatchStage, matchOtherStage, sortStage])
          .toArray(),

        db
          .collection("tbltasks")
          .aggregate([...baseMatchStage, matchTodayStage, sortStage])
          .toArray(),
      ]);
      res.json({ today: resultsToday, other: resultsOther });
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ error: "An error occurred" });
    }
  }
);

app.get("/api/projects", async (req, res) => {
  if (validataUser(req) === 0) {
    res.status(400).send("Invalid user id and user name");
    return;
  }

  try {
    const results = await db
      .collection("tblprojects")
      .find({
        $or: [{ accountsId: 0 }, { accountsId: req.session.userId }],
      })
      .toArray();
    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error retrieving projects");
  }
});

app.post(
  "/api/project/add",
  middleware.validateProjectName,
  async (req, res) => {
    if (validataUser(req) === 0) {
      res.status(400).send("Invalid user id and user name");
      return;
    }

    try {
      await db.collection("tblprojects").insertOne({
        accountsId: req.session.userId,
        projectName: req.body.projectName,
      });
      res.json({ status: "Project added" });
    } catch (error) {
      res.json({ error: "Project not added" });
      console.error(error);
    }
  }
);

app.post(
  "/api/project/update",
  middleware.validateUpdateProject,
  async (req, res) => {
    if (validataUser(req) === 0) {
      res.status(400).send("Invalid user id and user name");
      return;
    }

    let returnMessages = {};
    console.log("cuz", req.updateQuery);
    try {
      if (req.updateQuery && req.updateQuery.length > 0) {
        for (const { filter, update } of req.updateQuery) {
          console.log("duh", filter, update);
          await db.collection("tblprojects").updateMany(filter, update);

          await db
            .collection("tbltasks")
            .updateMany(
              { taskProject: filter.projectName },
              { $set: { taskProject: update.$set.projectName } }
            );
        }
        returnMessages["update"] = "Projects updated";
      }

      if (req.deleteQuery.$or && req.deleteQuery.$or.length > 0) {
        await db.collection("tblprojects").deleteMany(req.deleteQuery);
        returnMessages["delete"] = "Projects deleted";
      }

      res.json(returnMessages);
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

app.post(
  "/api/task/delete/:taskId",
  middleware.validateTaskId,
  async (req, res) => {
    if (validataUser(req) === 0) {
      res.status(400).send("Invalid user id and user name");
      return;
    }

    try {
      await db.collection("tbltasks").deleteOne({
        accountsId: req.session.userId,
        _id: new ObjectId(req.params.taskId),
      });
      res.json({ res: `task ${req.params.taskId} deleted` });
    } catch (error) {
      console.error(error);
      res.status(500).send("Error deleting task");
    }
  }
);

app.post(
  "/api/task/add",
  middleware.validateAndSanitizeTask,
  async (req, res) => {
    if (validataUser(req) === 0) {
      res.status(400).json({ error: "Invalid user id and user name" });
      return;
    }

    const { title, description, due_date, priority, project } =
      req.sanitizedBody;

    try {
      await db.collection("tbltasks").insertOne({
        accountsId: req.session.userId,
        taskName: title,
        taskDescription: description,
        taskDue: new Date(due_date),
        taskPriority: parseInt(priority, 10),
        taskProject: project,
        taskProgress: 0,
      });
      res.json({ status: "Task added" });
    } catch (error) {
      res.json({ error: "Task not added" });
      console.error(error);
    }
  }
);

app.post(
  "/api/task/update",
  middleware.validateAndSanitizeTask,
  async (req, res) => {
    if (validataUser(req) === 0) {
      res.status(400).json({ error: "Invalid user id and user name" });
      return;
    }

    const { title, description, due_date, priority, project, taskId } =
      req.sanitizedBody;

    try {
      await db.collection("tbltasks").updateOne(
        { _id: new ObjectId(taskId), accountsId: req.session.userId },
        {
          $set: {
            taskName: title,
            taskDescription: description,
            taskDue: new Date(due_date),
            taskPriority: parseInt(priority, 10),
            taskProject: project,
          },
        }
      );
      res.json({ status: "Task updated" });
    } catch (error) {
      res.json({ error: "Task not updated" });
      console.error(error);
    }
  }
);
app.post(
  "/api/account/update",
  middleware.validateUpdateAccount,
  async (req, res) => {
    if (validataUser(req) === 0) {
      res.status(400).send("Invalid user id and user name");
      return;
    }

    try {
      const userId = await loginUser(
        req.session.userName,
        req.body.current_password
      );
      if (userId === -1) {
        res.json({ error: "Username and password does not match" });
        return;
      }

      let updateFields = {};
      if (req.body.username) updateFields.accountUsername = req.body.username;
      if (req.body.email) updateFields.accountEmail = req.body.email;
      if (req.body.password) updateFields.accountPassword = req.body.password;

      await db
        .collection("tblaccounts")
        .updateOne(
          { _id: new ObjectId(req.session.userId) },
          { $set: updateFields }
        );

      if (req.body.username) req.session.userName = req.body.username;

      res.json({ status: "success" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

app.post(
  "/api/account/delete",
  middleware.validateCurrentPass,
  async (req, res) => {
    if (validataUser(req) === 0) {
      res.status(400).send("Invalid user id and user name");
      return;
    }

    try {
      const userId = await loginUser(
        req.session.userName,
        req.body.current_password
      );
      if (userId === -1) {
        res.json({ error: "Username and password does not match" });
        return;
      }

      const result = await db
        .collection("tblaccounts")
        .deleteOne({ _id: new ObjectId(userId) });

      if (result.deletedCount === 1) {
        res.json({ status: "success" });
      } else {
        res.status(500).json({ status: "Cannot delete account" });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

app.post("/api/share", middleware.validateIds, async (req, res) => {
  if (validataUser(req) === 0) {
    res.status(400).send("Invalid user id and user name");
    return;
  }

  try {
    await db.collection("tblsharedtables").insertOne({
      accountId: new ObjectId(req.body.accountId),
      taskId: new ObjectId(req.body.taskId),
    });
    res.json({ status: "success" });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error sharing task");
  }
});

app.post("/api/share/delete", middleware.validateIds, async (req, res) => {
  if (validataUser(req) === 0) {
    res.status(400).send("Invalid user id and user name");
    return;
  }

  try {
    await db.collection("tblsharedtables").deleteOne({
      taskId: new ObjectId(req.body.taskId),
      accountId: new ObjectId(req.body.accountId),
    });
    res.json({ status: "Account removed from shared task" });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error removing account from shared task");
  }
});

app.get("/api/users/:taskId", middleware.validateTaskId, async (req, res) => {
  if (validataUser(req) === 0) {
    res.status(400).send("Invalid user id and user name");
    return;
  }

  try {
    const query = [
      {
        $lookup: {
          from: "tblsharedtables",
          let: { accountId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$$accountId", "$accountId"] },
                taskId: new ObjectId(req.params.taskId),
              },
            },
          ],
          as: "shared",
        },
      },
    ];

    console.log(req.params.taskId);
    const [notShared, shared] = await Promise.all([
      db
        .collection("tblaccounts")
        .aggregate([
          ...query,
          {
            $match: {
              $expr: { $ne: ["$_id", new ObjectId(req.session.userId)] },
              shared: { $eq: [] },
            },
          },
        ])
        .toArray(),
      db
        .collection("tblaccounts")
        .aggregate([
          ...query,
          {
            $match: {
              $expr: { $ne: ["$_id", new ObjectId(req.session.userId)] },
              shared: { $ne: [] },
            },
          },
        ])
        .toArray(),
    ]);
    console.log("shared", shared, notShared);
    res.json({ notShared: notShared, shared: shared });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

function validataUser(req) {
  return db.collection("tblaccounts").countDocuments({
    $or: [
      { accountUsername: req.session.userName },
      { _id: new ObjectId(req.session.userId) },
    ],
  });
}

async function loginUser(username, password) {
  try {
    const user = await db
      .collection("tblaccounts")
      .findOne({ accountUsername: username });
    if (!user) return -1;
    const isMatch = await bcrypt.compare(password, user.accountPassword);
    return isMatch ? user._id : -1;
  } catch (error) {
    console.error(error);
    return -1;
  }
}

function updateProgress() {
  db.collection("tbltasks").updateMany(
    { taskDue: { $lt: new Date().toISOString().split("T")[0] } },
    { $set: { taskProgress: "Overdue" } }
  );
}

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
