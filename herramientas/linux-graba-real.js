/* Graba en linux-real.json lo que responde una Ubuntu 24.04 real a los casos de linux-casos.js.
 *
 *   node herramientas/linux-graba-real.js [máquina] [usuario] [contraseña]
 *
 * Usa la máquina de VirtualBox de pruebas (por defecto «Ubuntu», usuario lucia, contraseña alumno), que debe
 * estar encendida con las Guest Additions. Solo escribe dentro de /tmp/simprueba del invitado: copia allí un
 * programa en Python que monta el escenario de cada caso en /tmp/simprueba/w, ejecuta la orden con bash -c y
 * guarda la salida, los errores y el código de salida. No instala nada ni cambia la configuración.
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FIXTURE, CASOS } = require('./linux-casos.js');

const VM = process.argv[2] || 'Ubuntu', USUARIO = process.argv[3] || 'lucia', CLAVE = process.argv[4] || 'alumno';
const VBOX = process.env.VBOXMANAGE || 'C:\\Program Files\\Oracle\\VirtualBox\\VBoxManage.exe';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'simprueba-'));
const PY = `import json, os, shutil, subprocess, sys
d = json.load(open(sys.argv[1], encoding='utf-8'))
base = '/tmp/simprueba/w'
env = {k: v for k, v in os.environ.items() if k not in ('TERM', 'LANGUAGE', 'COLUMNS', 'LINES')}
env['LANG'] = 'es_ES.UTF-8'
res = []
def limpia():
    subprocess.run(['chmod', '-R', 'u+rwx', base], capture_output=True)
    subprocess.run(['rm', '-rf', base], capture_output=True)
for c in d['casos']:
    limpia()
    os.makedirs(base)
    subprocess.run(['bash', '-c', '\\n'.join(d['fixture'])], cwd=base, env=env, stdin=subprocess.DEVNULL, capture_output=True)
    try:
        p = subprocess.run(['bash', '-c', c['orden']], cwd=base, env=env, stdin=subprocess.DEVNULL, capture_output=True, timeout=30)
        res.append({'orden': c['orden'], 'stdout': p.stdout.decode('utf-8', 'replace'), 'stderr': p.stderr.decode('utf-8', 'replace'), 'codigo': p.returncode})
    except subprocess.TimeoutExpired:
        res.append({'orden': c['orden'], 'stdout': '', 'stderr': '', 'codigo': None, 'tiempo': True})
limpia()
json.dump(res, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
`;
fs.writeFileSync(path.join(tmp, 'graba.py'), PY);
fs.writeFileSync(path.join(tmp, 'casos.json'), JSON.stringify({ fixture: FIXTURE, casos: CASOS }));
const vb = (args, opc) => execFileSync(VBOX, args, Object.assign({ encoding: 'utf8', maxBuffer: 64 << 20 }, opc || {}));
const cred = ['--username', USUARIO, '--password', CLAVE];
vb(['guestcontrol', VM, 'run', ...cred, '--exe', '/bin/mkdir', '--', '-p', '/tmp/simprueba']);
vb(['guestcontrol', VM, 'copyto', ...cred, '--target-directory', '/tmp/simprueba/', path.join(tmp, 'graba.py'), path.join(tmp, 'casos.json')]);
console.log(`Ejecutando ${CASOS.length} casos en ${VM}…`);
vb(['guestcontrol', VM, 'run', ...cred, '--timeout', '600000', '--exe', '/usr/bin/python3', '--', '/tmp/simprueba/graba.py', '/tmp/simprueba/casos.json', '/tmp/simprueba/real.json']);
vb(['guestcontrol', VM, 'copyfrom', ...cred, '--target-directory', tmp + path.sep, '/tmp/simprueba/real.json']);
const real = JSON.parse(fs.readFileSync(path.join(tmp, 'real.json'), 'utf8'));
const info = vb(['guestcontrol', VM, 'run', ...cred, '--exe', '/bin/bash', '--', '-c', 'uname -r; . /etc/os-release; echo "$PRETTY_NAME"; date -Iseconds']).trim().split('\n');
const salida = { maquina: { nucleo: info[0], sistema: info[1], fecha: info[2], usuario: USUARIO, equipo: 'ubuntu-' + USUARIO }, fixture: FIXTURE, casos: real.map((r, i) => Object.assign({ ordenar: !!CASOS[i].ordenar }, r)) };
// las salidas de la máquina Ubuntu-SOM con UEFI (ubuntuSom) no se graban aquí: se conservan
try { const previo = JSON.parse(fs.readFileSync(path.join(__dirname, 'linux-real.json'), 'utf8')); if (previo.ubuntuSom) salida.ubuntuSom = previo.ubuntuSom; } catch (e) { /* no había */ }
fs.writeFileSync(path.join(__dirname, 'linux-real.json'), JSON.stringify(salida, null, 1) + '\n');
console.log(`Guardados ${real.length} casos en herramientas/linux-real.json`);
