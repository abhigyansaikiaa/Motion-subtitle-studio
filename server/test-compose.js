const { compose } = require('./engine/CompositionEngine');
const wordsRaw = [{id:'w0', end:1.39, word:'It is', start:0.85}, {id:'w1', end:1.85, word:'a', start:1.39}, {id:'w2', end:2.5, word:'test.', start:1.85}];
console.log(JSON.stringify(compose(wordsRaw, 'editorial'), null, 2));
