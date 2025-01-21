const { exec } = require("child_process");

async function runTasks() {
  try {
    const taskA = exec("node fetchTransactionRecords.js");
    taskA.stdout.pipe(process.stdout);
    taskA.stderr.pipe(process.stderr);
    await new Promise((resolve, reject) => {
      taskA.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`fetchTransactionRecords.js error: ${code}`));
      });
    });

    const taskB = exec("node calcPoints.mjs");
    taskB.stdout.pipe(process.stdout);
    taskB.stderr.pipe(process.stderr);
    await new Promise((resolve, reject) => {
      taskB.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`calcPoints.mjs error: ${code}`));
      });
    });
  } catch (error) {
    console.error(error);
  }
}

runTasks();
