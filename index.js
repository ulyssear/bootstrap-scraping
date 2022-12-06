// Bootstrap
let logger;
const DateHelper = {
  now() {
    return new Date().toLocaleString(Intl.DateTimeFormat().resolvedOptions().locale).replace(', ', ' ');
  },
};
const fs = require('fs');
const path = require('path');
const { dirname } = path;

function Logger(_path) {
  const logsPath = path.resolve(_path, 'logs');
  if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath, { recursive: true });
  }

  const files = {
    info: null,
    error: 'red',
    debug: 'blue',
    success: 'green',
  };

  for (const fileName in files) {
    const color = files[fileName];
    const file = fs.createWriteStream(path.resolve(logsPath, `${fileName}.txt`), { flags: 'a' });
    file.on('error', (err) => {
      if (err) {
        console.error(err);
      }
    });
    this[fileName] = (message) => _generic.bind(file)(color, message);
  }

  function _generic(color, message) {
    const date = DateHelper.now();
    const content = `[${date}] ${message}`;
    console.log(content);
    this.write(content + '\n');
    return true;
  }
}
const puppeteer = ((puppeteer) => {
  puppeteer.use(require('puppeteer-extra-plugin-stealth')());
  return puppeteer;
})(require('puppeteer-extra'));
//--------------------------------------------------------------

// Core
let data;
let browser;
let isLaunching = false;
let runningTasks = [];

const rootPath = path.resolve(require.main.path);
const dataPath = path.resolve(rootPath, 'data');

const headless = -1 < process.argv.indexOf('--headless');

const _run = async function run({ name = 'default', path: _path = 'default', url, callable, options = {} }) {

  options = Object.apply({
    noSave: false,
  }, options);

  const { noSave } = options;

  let page;
  runningTasks.push(name);

  if (!isLaunching) {
    const executablePath = process.argv.find((arg) => arg.startsWith('--executable_path')).replace('--executable_path=', '');
    logger.debug('Launching browser');
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
      logger.error(`Cannot open page "${url}"`);
      break;
    }
    try {
      logger.debug('Opening new page');
      page = await browser.newPage();
      logger.debug(`Going to "${url}"`);
      await page.goto(url);
      break;
    } catch (e) {
      cursorLimit++;
      logger.error(e);
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
    logger.error(e);
  }

  if (!headless ?? false) {
    const timeouts = [500, 3000, 10000, 30000, 60000];
    cursorLimit = 0;
    while (true) {
      if (cursorLimit >= limit) {
        const message = `Error while opening "${url}".`;
        logger.error(message);
        break;
      }

      try {
        logger.debug(`Waiting for ${timeouts[cursorLimit]}ms`);
        await page.waitForTimeout(timeouts[cursorLimit]);
        data = await callable(page);
        break;
      } catch (e) {
        cursorLimit++;
        logger.error(e);
      }
    }
  }

  logger.debug('Closing page');
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

  return 0;
};

function writeJSON(_path, name, url, content) {
  const pathdir = path.resolve(this.directory, dirname((_path = `${_path}.json`)));
  if (!fs.existsSync(pathdir)) {
    fs.mkdirSync(pathdir, { recursive: true });
  }
  fs.writeFileSync(path.resolve(pathdir, _path), JSON.stringify({ name, url, date: Date.now(), ...content }));
  return 0;
}

const ScraperPrototype = {
  logger: undefined,
  directory: undefined,

  writeJSON,

  addTask: function addTask({ name, path: _path, url, callable, options = {} }) {
    this.tasks.push({ name, path: _path, url, callable, options });
  },

  run: async function run() {
    for (const task of this.tasks) {
      const { name, path: _path, url, callable, options } = task;
      await _run({ name, path: _path, url, callable, options });
    }
  },

  runTask: async function runTask(name) {
    const task = this.tasks.find((task) => task.name === name);
    if (!task) {
      throw new Error(`Task "${name}" not found`);
    }
    await _run(task);
  }
};

function Scraper({ name = 'default', path: _path = 'default', tasks = [], directory = path.resolve(__dirname) }) {
  this.tasks = tasks;
  this.name = name;
  this.path = _path;
  this.directory = directory;
  this.logger = new Logger(this.directory);
  logger = this.logger;
}

Object.assign(Scraper.prototype, ScraperPrototype);
//--------------------------------------------------------------

// Export module
module.exports = Scraper;
//--------------------------------------------------------------
