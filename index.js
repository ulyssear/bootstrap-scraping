// Bootstrap
const fs = require("fs");
const path = require("path");
const { dirname } = path;

const puppeteer = ((puppeteer) => {
  puppeteer.use(require("puppeteer-extra-plugin-stealth")());
  return puppeteer;
})(require("puppeteer-extra"));
//--------------------------------------------------------------

// Core
let data;
let browser;
let isLaunching = false;
let runningTasks = [];

const rootPath = path.resolve(require.main.path);
const dataPath = path.resolve(rootPath, "data");

const headless = -1 < process.argv.indexOf("--headless");

const _run = function run({
  name = "default",
  path: _path = "default",
  url,
  callable,
  options = {},
}) {
  return new Promise(async (resolve, reject) => {
    options = Object.apply(
      {
        noSave: false,
      },
      options
    );

    const { noSave } = options;

    let page;
    runningTasks.push(name);

    if (!isLaunching) {
      const executablePath = process.argv
        .find((arg) => arg.startsWith("--executable_path"))
        .replace("--executable_path=", "");
      browser = await puppeteer.launch({
        headless,
        executablePath,
      });
      isLaunching = true;
    }

    const limit = 5;
    let cursorLimit = 0;

    while (true) {
      if (cursorLimit >= limit) {
        break;
      }
      try {
        page = await browser.newPage();
        await page.goto(url);
        break;
      } catch (e) {
        cursorLimit++;
        if (page) {
          if (page.close) {
            page.close();
          }
        }
      }
    }

    try {
      data = await callable(page);
    } catch (e) {
    }

    if (!headless ?? false) {
      const timeouts = [500, 3000, 10000, 30000, 60000];
      cursorLimit = 0;
      while (true) {
        if (cursorLimit >= limit) {
          break;
        }

        try {
          await page.waitForTimeout(timeouts[cursorLimit]);
          data = await callable(page);
          break;
        } catch (e) {
          cursorLimit++;
        }
      }
    }
    
    await page.close();

    runningTasks.splice(runningTasks.indexOf(name), 1);

    setTimeout(async () => {
      if (1 > runningTasks.length) {
        await browser.close();
      }
    }, 2000);

    if (!noSave) {
      if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true });
      }
      writeJSON(path.resolve(dataPath, _path), name, url, { data });
    }

    resolve(0);
  });
};

function writeJSON(_path, name, url, content) {
  const pathdir = path.resolve(
    this.directory,
    dirname((_path = `${_path}.json`))
  );
  if (!fs.existsSync(pathdir)) {
    fs.mkdirSync(pathdir, { recursive: true });
  }
  fs.writeFileSync(
    path.resolve(pathdir, _path),
    JSON.stringify({ name, url, date: Date.now(), ...content })
  );
  return 0;
}

let cursor = 0, cursor_to_do = 0;

const ScraperPrototype = {
  tasks: [],
  directory: undefined,

  writeJSON,

  addTask: function addTask({
    name,
    path: _path,
    url,
    callable,
    options = {},
  }) {
    this.tasks.push({ name, path: _path, url, callable, options });
  },

  run: async function run() {
    const CHUNK_SIZE = 5;

    showOutput( 'Ulysse', '1.0.0', this.tasks);
    // showProgress();

    while (this.tasks.length) {
      const group_tasks = this.tasks.splice(0, CHUNK_SIZE);
      for (let i = 0; i < group_tasks.length; i++) {
        const entry = new Promise(async (resolve, reject) => {
          await _run(group_tasks[i]);
          cursor++
          // showProgress();
          resolve(0);
        });
        group_tasks[i] = entry;
      }
      cursor_to_do += Object.keys(group_tasks).length;
      await Promise.all(group_tasks);
    }

    cursor = 0;
    cursor_to_do = 0;
    this.tasks = [];


    function showOutput(name, version, tasks = this.tasks) {
      const output = [];
      const tasks_list = tasks.map((task) => `${task.name} (${task.url})`);
      output.push(`@ulyssear/scraper is running !`);
      output.push("");
      output.push(`Bot name : ${name}`);
      output.push(`Version : ${version}`);
      output.push("");
      output.push(`${tasks.length} tasks to run :`);
      if (5 < tasks.length) {
        output.push(`- ${tasks_list.slice(0, 2).join("\n- ")}`);
        output.push(`- ...`);
        output.push(`- ${tasks_list.slice(tasks.length - 2).join("\n- ")}`);
      } else {
        output.push(`- ${tasks_list.join("\n- ")}`);
      }
      output.push("", "");
      process.stdout.write("\x1Bc");
      process.stdout.write(output.join("\n"));
      return 0;
    }

    function showProgress() {
      process.stdout.write(`\r${cursor} tasks done / ${cursor_to_do} tasks launched`);
      return 0;
    }
  },

  runTask: async function runTask(name) {
    const task = this.tasks.find((task) => task.name === name);
    if (!task) {
      throw new Error(`Task "${name}" not found`);
    }
    await _run(task);
  },
};

function Scraper({
  name = "default",
  date,
  path: _path = "default",
  tasks = [],
  directory = path.resolve(__dirname),
}) {
  this.tasks = tasks;
  this.name = name;
  this.date = date;
  this.path = _path;
  this.directory = directory;
}

Object.assign(Scraper.prototype, ScraperPrototype);
//--------------------------------------------------------------

// Export module
module.exports = Scraper;
//--------------------------------------------------------------
