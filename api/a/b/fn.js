export function fn1(req, res) {
  res.send('Fn1');
}

export function fn2(req, res) {
  res.send('Fn2');
}

export function index(req, res) {
  res.send(`${req.path} index from api/a/b/fn.js`);
}