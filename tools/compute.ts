import { createHash } from 'crypto';

console.log(createHash('sha1').update('test-db').digest('hex'));
console.log(createHash('md5').update('test-db').digest('hex'));
console.log(createHash('sha256').update('test-db.sqlite').digest('hex'));
console.log('8c4adb7a51078a272a8336d1d6f606acb37a5564b94ce38b4862ef2734d493a1');
