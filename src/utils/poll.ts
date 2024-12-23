export default function poll(fn: any) {
  const endTime = Number(new Date()) + 1000 * 60 * 5;
  const interval = 3000;

  const checkCondition = (resolve: any, reject: any) => {
    if (Number(new Date()) > endTime) {
      return reject(new Error("Timed out"));
    }

    const result = fn();
    result.then((res: any) => {
      if (res) {
        resolve(res);
      } else {
        setTimeout(checkCondition, interval, resolve, reject);
      }
    });
  };

  return new Promise(checkCondition);
}
