// Bootstrap
const DateHelper = {
	now() {
		return new Date().toLocaleString(Intl.DateTimeFormat().resolvedOptions().locale).replace(', ', ' ');
	},
};
// const { terminal } = require('terminal-kit');
const fs = require('fs');
const path = require('path');
const Logger = function (path) {
	const logsPath = `${relative(__dirname, path)}\\logs`;
	if (!fs.existsSync(logsPath)) {
		fs.mkdirSync(logsPath, { recursive: true });
	}

	const files = [
		['name', 'color'],
		['info', null],
		['error', 'red'],
		['debug', 'blue'],
		['success', 'green'],
	];

	for (const [fileName, color] of files.splice(1)) {
		const file = fs.createWriteStream(`.\\${logsPath}\\${fileName}.txt`);
		file.on('error', (err) => {
			if (err) {
				console.error(err);
			}
		});
		this[fileName] = (message) => _generic.bind(file)(color, message);
	}

	function _generic(color, message) {
		const date = DateHelper.now();
		const content = `[${date}] ${message}\n`;
		// if (color) {
		// 	terminal[color](content);
		// } else {
		// 	terminal(content);
		// }
		console.log(content);
		this.write(content);
		return true;
	}
};
const puppeteer = ((puppeteer) => {
	puppeteer.use(require('puppeteer-extra-plugin-stealth')());
	return puppeteer;
})(require('puppeteer-extra'));
const { relative, dirname } = path;
//--------------------------------------------------------------

// Core
let browser;

let isLaunching = false;
let runningTasks = [];

const projectPath = path.resolve(__dirname, 'result');

const headless = -1 < process.argv.indexOf('--headless');

const logger = new Logger(dirname(require.main.filename));

const run = async function run({ name = 'default', url, callable }) {
	runningTasks.push(name);

	if (!isLaunching) {
		logger.debug('Launching browser');
		browser = await puppeteer.launch({
			headless,
			args: ['--disable-web-security'],
			executablePath: process.argv.find((arg) => arg.startsWith('--executablePath=')).replace('--executablePath=', ''),
		});
		isLaunching = true;
	}

	const limit = 5;
	let page;
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

	page.original_$eval = page.$eval;
	page.original_$$eval = page.$$eval;
	page.$eval = $eval.bind(page);
	page.$$eval = $$eval.bind(page);

	let data;

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
				await page.waitForNavigation({ timeout: timeouts[cursorLimit], waitUntil: 'load' });
				data = await callable();
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

	writeJSON(`${projectPath}/result/${name}`, url, { data });

	return 0;
};

const $eval = async function $eval(selector, callback, waitingMessage, argumentsWaitForSelector = [], argumentsEval = []) {
	return _genericEval(this, '$eval', selector, callback, waitingMessage, argumentsWaitForSelector, argumentsEval);
};

const $$eval = async function $$eval(selector, callback, waitingMessage, argumentsWaitForSelector = [], argumentsEval = []) {
	return _genericEval(this, '$$eval', selector, callback, waitingMessage, argumentsWaitForSelector, argumentsEval);
};

async function _genericEval(page, name, selector, callback, waitingMessage, argumentsWaitForSelector = [], argumentsEval = []) {
	logger.info(waitingMessage ?? `Waiting for element "${selector}"`);
	let element = undefined;
	try {
		await page.waitForSelector(selector, ...argumentsWaitForSelector);
		element = await page[`original_${name}`](selector, callback, ...argumentsEval);
	} catch (e) {
		logger.error(e);
	}
	return element;
}

function writeJSON(path, url, content) {
	const pathdir = dirname((path = `${path}.json`));
	if (!fs.existsSync(pathdir)) {
		fs.mkdirSync(pathdir, { recursive: true });
	}
	fs.writeFileSync(path, JSON.stringify({ url, date: Date.now(), ...content }));
	return 0;
}
//--------------------------------------------------------------

// Export modules
module.exports = {
	run,
	Logger,
	writeJSON,
	puppeteer,
	$eval,
	$$eval,
};
//--------------------------------------------------------------
