/* Casos para comparar el simulador de Linux con una Ubuntu 24.04 real.
 * Cada caso se ejecuta con `bash -c` (sin terminal) en /tmp/simprueba/w, después de montar el mismo
 * escenario (FIXTURE) en la máquina real y en el simulador. linux-graba-real.js los ejecuta en la máquina
 * de VirtualBox y guarda salida, errores y código en linux-real.json; prueba-linux.js los compara.
 * ordenar: true -> se comparan las líneas ordenadas (find y du recorren en el orden del disco, que en ext4 no
 * es el de creación). */
const FIXTURE = [
  'mkdir -p empresa/datos empresa/backups empresa/scripts',
  'sleep 0.02',
  "printf 'Mes,Vendedor,Ventas,Beneficio\\nEnero,ana,1200,300\\nEnero,luis,950,180\\nFebrero,ana,1100,260\\nFebrero,marta,1300,350\\nMarzo,luis,800,120\\nMarzo,marta,1250,330\\n' > empresa/datos/resumen.csv",
  "printf 'ana\\nluis\\nmarta\\n' > empresa/datos/vendedores.txt",
  "printf '#!/bin/bash\\necho \"Informe de ventas\"\\nwc -l datos/resumen.csv\\n' > empresa/scripts/informe.sh",
  "echo 'Notas de la reunión' > notas.txt",
  'echo hola > a.txt',
  'echo adiós > b.txt',
  'touch vacio.txt',
  'sleep 0.02',
  'mkdir vacia',
  'sleep 0.02',
  'mkdir -m 700 privada',
  'sleep 0.02',
  'ln -s notas.txt enlace',
  'sleep 0.02',
  'ln -s noexiste roto',
  "touch -d '2026-11-01 10:00' empresa/datos/vendedores.txt",
  "touch -d '2026-10-15 09:00' notas.txt",
  "touch -d '2026-11-10 12:30' a.txt",
  "touch -d '2025-05-20 08:00' b.txt",
  "touch -d '2026-11-20 18:00' vacio.txt",
];
const C = (orden, extra) => Object.assign({ orden }, extra || {});
const CASOS = [
  // ls
  C('ls'), C('ls -a'), C('ls -A'), C('ls -l'), C('cd empresa; ls -la'), C('ls -lh empresa/datos'), C('ls -lt'), C('ls -ltr'), C('ls -r'),
  C('ls -d empresa'), C('ls -ld empresa vacia'), C('ls -R empresa'), C('ls -1'), C('ls -C'), C('ls -F'), C('ls -l enlace roto'), C('ls -lA empresa'),
  C('ls noexiste'), C('ls -l noexiste a.txt'), C('ls -z'), C('ls --foo'), C('ls empresa vacia'), C('ls -l /dev/null /dev/sda'), C('ls -ld /tmp /root | cut -c1-10'),
  C('ls /root'), C('ls -lS'), C('ls *.txt'), C('ls -d */'), C('ls empresa/*/'), C('ls -l empresa/scripts/informe.sh'),
  // cd y pwd
  C('cd empresa; pwd'), C('cd empresa/datos; cd ..; pwd'), C('cd /; pwd'), C('cd; pwd'), C('cd ~; pwd'), C('cd /tmp; cd -'), C('cd noexiste'), C('cd a.txt'), C('cd a b'),
  C('cd /root'), C('cd enlace'), C('cd /bin; pwd; pwd -P'), C('cd empresa; cd -; pwd'),
  // mkdir, rmdir, touch
  C('mkdir nueva; ls -ld nueva'), C('mkdir empresa'), C('mkdir x/y/z'), C('mkdir -p x/y/z; ls -R x'), C('mkdir'), C('mkdir -v otra'), C('mkdir -pv p1/p2'),
  C('mkdir /root/x'), C('mkdir -p empresa/{datos,backups,scripts,informes}; ls empresa'), C('mkdir -m 750 m; ls -ld m'),
  C('rmdir vacia; ls'), C('rmdir empresa'), C('rmdir noexiste'), C('rmdir a.txt'), C('rmdir'), C('mkdir -p q/w; rmdir -p q/w; ls'), C('rmdir -p empresa/datos'),
  C('touch nuevo.txt; ls -l nuevo.txt'), C('touch /root/x'), C('touch noexiste/x'), C('touch'), C("touch -d '2026-01-15 10:30' f; ls -l f"), C('touch -t 202601151030 f2; ls -l --full-time f2'),
  // cp, mv, rm
  C('cp a.txt c.txt; cat c.txt'), C('cp a.txt'), C('cp'), C('cp noexiste z'), C('cp vacia z'), C('cp -r vacia z; ls -d z'), C('cp a.txt b.txt empresa/noexiste'),
  C('cp a.txt a.txt'), C('cp -v a.txt c.txt'), C('cp a.txt b.txt empresa; ls empresa'), C('cp -r empresa copia; ls -R copia'), C('cp a.txt notas.txt vacio.txt'),
  C('cp -r empresa empresa/datos'), C('cp /etc/shadow s'), C('cp a.txt /root/'),
  C('mv a.txt c.txt; ls'), C('mv noexiste z'), C('mv a.txt'), C('mv a.txt a.txt'), C('mv empresa empresa/datos'), C('mv a.txt b.txt vacia; ls vacia'), C('mv vacia vacia2; ls -d vacia2'),
  C('mv a.txt b.txt noexiste'), C('mv /etc/hostname x'),
  C('rm a.txt; ls'), C('rm noexiste'), C('rm vacia'), C('rm -r vacia; ls'), C('rm -f noexiste'), C('rm'), C('rm -v a.txt'), C('rm -rv empresa', { ordenar: true }), C('rm /etc/passwd'),
  C('rm -r noexiste'), C('rm -d vacia; ls -d vacia'), C('rm -r /root'),
  // ln, file, stat
  C('ln a.txt duro; ls -l a.txt duro | cut -c1-12'), C('ln a.txt duro; ln a.txt duro'), C('ln vacia dd'), C('ln noexiste z'), C('ln -s a.txt s1; ls -l s1; cat s1'),
  C('ln -s a.txt enlace'), C('cat roto'), C('file a.txt vacia noexiste'), C('file vacio.txt enlace roto'), C('file empresa/scripts/informe.sh'), C('file empresa/datos/resumen.csv'),
  C('file /dev/null /dev/sda /tmp'), C('printf "sin fin" > s; file s'), C('stat noexiste'), C('stat -f . | head -1'),
  // cat, head, tail, wc
  C('cat a.txt b.txt'), C('cat -n empresa/datos/resumen.csv'), C('cat noexiste'), C('cat vacia'), C('cat -z'), C('cat /etc/shadow'), C('cat a.txt noexiste b.txt'),
  C('head -n 3 empresa/datos/resumen.csv'), C('head -3 empresa/datos/resumen.csv'), C('head -c 5 empresa/datos/resumen.csv'), C('head noexiste'), C('head -n x a.txt'),
  C('head a.txt b.txt'), C('head -n -2 empresa/datos/resumen.csv'), C('tail -n 2 empresa/datos/resumen.csv'), C('tail -2 empresa/datos/resumen.csv'),
  C('tail -n +2 empresa/datos/resumen.csv'), C('tail noexiste'), C('tail -c 4 a.txt'),
  C('wc empresa/datos/resumen.csv'), C('wc -l empresa/datos/resumen.csv empresa/datos/vendedores.txt'), C('wc -w notas.txt'), C('wc -c b.txt'), C('wc -m b.txt'),
  C('wc -L empresa/datos/resumen.csv'), C('wc noexiste'), C('echo hola | wc'), C('wc -l < empresa/datos/resumen.csv'), C('echo "ñandú" | wc -c -m'), C('wc vacia'),
  // sort, cut, tee
  C('sort empresa/datos/vendedores.txt'), C('sort -r empresa/datos/vendedores.txt'), C('cut -d, -f2 empresa/datos/resumen.csv | sort -u'),
  C('printf "10\\n9\\n100\\n" | sort'), C('printf "10\\n9\\n100\\n" | sort -n'), C('sort -t, -k3 -n empresa/datos/resumen.csv'), C('sort -t, -k3 -nr empresa/datos/resumen.csv | head -1'),
  C('printf "b\\na\\n" | sort -c'), C('sort -c empresa/datos/vendedores.txt'), C('sort noexiste'), C('printf "Ana\\nana\\nÁlvaro\\nbeto\\nBeto\\n_x\\n1\\n" | sort'),
  C('tail -n +2 empresa/datos/resumen.csv | sort -t, -k2,2 -k3,3n'),
  C('cut -d, -f1 empresa/datos/resumen.csv'), C('cut -d, -f2,4 empresa/datos/resumen.csv'), C('cut -c1-3 empresa/datos/vendedores.txt'), C('cut -d, -f3- empresa/datos/resumen.csv'),
  C('cut empresa/datos/resumen.csv'), C('cut -d: a.txt'), C('cut -f 2 -d , noexiste'), C('echo "ñandú" | cut -c1-2'), C('cut -d, -f5 empresa/datos/resumen.csv | head -2'),
  C('echo hola | tee t1.txt; cat t1.txt'), C('echo uno | tee t; echo dos | tee -a t; cat t'), C('echo x | tee /root/x'),
  // grep
  C('grep ana empresa/datos/resumen.csv'), C('grep -n ana empresa/datos/resumen.csv'), C('grep -c Enero empresa/datos/resumen.csv'), C('grep -i ENERO empresa/datos/resumen.csv'),
  C('grep -v ana empresa/datos/resumen.csv'), C('grep -w an empresa/datos/resumen.csv'), C('grep zzz empresa/datos/resumen.csv'), C('grep ana noexiste'), C('grep'),
  C('grep ana empresa'), C('grep -r ana empresa', { ordenar: true }), C('grep -rl ana .', { ordenar: true }), C('grep ^M empresa/datos/resumen.csv'), C('grep 0$ empresa/datos/resumen.csv'),
  C('grep -A1 luis empresa/datos/resumen.csv'), C('grep -B1 marta empresa/datos/resumen.csv'), C('grep -C1 Febrero empresa/datos/resumen.csv'),
  C("grep -E 'ana|marta' empresa/datos/resumen.csv"), C('grep -e luis -e marta empresa/datos/resumen.csv'), C('grep ana *'), C('grep -l ana *'),
  C('grep -o "[0-9]*00" empresa/datos/resumen.csv'), C('grep -x ana empresa/datos/vendedores.txt'), C('cat empresa/datos/resumen.csv | grep -c a'), C('grep "Ma.zo" empresa/datos/resumen.csv'),
  C('grep -h ana empresa/datos/resumen.csv empresa/datos/vendedores.txt'), C('grep "[[:digit:]]\\{4\\}" empresa/datos/resumen.csv'),
  // find
  C('find . -name "*.txt"', { ordenar: true }), C('find . -type d', { ordenar: true }), C('find noexiste'), C('find . -empty', { ordenar: true }), C('find . -maxdepth 1 -type f', { ordenar: true }),
  C('find . -iname "A*"', { ordenar: true }), C('find empresa -name "*.csv"'), C('find . -not -name "*.txt" -type f', { ordenar: true }), C('find . -size -1k', { ordenar: true }),
  C('find . -name a.txt -exec cat {} \\;'), C('find . -foo'), C('find /root'), C('find . -name'), C('find . -type l', { ordenar: true }), C('find empresa -type f -name "*.sh"'),
  C('find . -name "*.txt" -o -type d', { ordenar: true }), C('find . -mtime +5 -type f', { ordenar: true }), C('find . -newer notas.txt -type f', { ordenar: true }), C('find . -type x'),
  // du
  C('du empresa', { ordenar: true }), C('du -h empresa', { ordenar: true }), C('du -s empresa'), C('du -sh empresa a.txt'), C('du noexiste'), C('du -a empresa/datos', { ordenar: true }),
  // echo, comillas y expansiones
  C('echo $HOME $USER $SHELL'), C("echo '$HOME' \"$HOME\" \\$HOME"), C('echo a\\ \\ b "c  d" e'), C('echo $((3+4*2)) $((10/3)) $((10%3)) $((2**10))'), C('echo $((1/0))'),
  C('echo $((5 > 3)) $((-7/2))'), C('echo {a,b,c}.txt x{1..3} {5..1} {a..e}'), C('echo {1..10..3} {01..03}'), C('echo *.txt'), C('echo *.zzz'), C('echo ?.txt [ab].txt [!a].txt'),
  C('echo ~ ~/x ~root ~noexiste'), C('echo $(echo uno) `echo dos`'), C('echo -n hola; echo'), C('echo -e "a\\tb\\nc"'), C('echo "a\\tb"'), C('false; echo $?; true; echo $?'),
  C('ls noexiste 2>/dev/null; echo $?'), C('ls noexiste > /dev/null 2>&1; echo $?'), C('echo uno > f1; echo dos >> f1; cat f1'), C('ls noexiste 2> err.txt; cat err.txt'),
  C('ls a.txt noexiste > out.txt 2>&1; cat out.txt'), C('cat < noexiste'), C('echo x > /root/y'), C('echo x > vacia'), C('echo x > noexiste/f'),
  C('true && echo si || echo no; false && echo si || echo no'), C('echo "sin cerrar'), C('echo a |'), C('echo a ;; echo b'), C('echo a | | echo b'), C('| echo'),
  C('x=5; echo $x; echo ${x}y; echo "$x"'), C('echo $noexiste.x'), C('unset x; echo ${x:-def}'), C('f=resumen.csv; echo ${f%.csv} ${f#res}'), C('echo $(( (2+3)*4 ))'),
  C('echo "Hoy hay $(ls | wc -l) cosas"'), C('cat a.txt | cat | cat'), C('echo a; echo b; echo c'), C('echo uno && ls noexiste && echo dos'), C('ls noexiste || echo fallo'),
  C('echo "$(cat a.txt)"'), C('n=3; echo $((n * 2))'), C('echo \'una "comilla"\''), C('echo "dos \'comillas\'"'), C('echo $((3+))'),
  // varias del sistema
  C('whoami'), C('whoami x'), C('id -un'), C('id -u; id -g; id -G; id -gn'), C('id root'), C('id noexiste'), C('groups'), C('uname -s'), C('uname -r'), C('uname -m'), C('uname -o'),
  C('uname -srm'), C('uname -x'), C('date +%Y'), C('date +%j %U'), C('date --foo'), C('date -d 2026-01-01'), C('date -d 2026-01-01 +%A'), C('date "+%d/%m/%Y" -d 2026-03-05'),
  C('pwd x'), C('pwd -P'), C('which ls grep'), C('which noexiste; echo $?'), C('which cd; echo $?'), C('whereis ls'), C('whereis cd'), C('whereis noexiste'),
  C('printenv HOME'), C('printenv NOEXISTE; echo $?'), C('type cd'), C('type noexiste'), C('exit 3'), C('exit abc'), C('exit 1 2'), C('true; echo $?'),
  C('tree'), C('cal'), C('locate x'), C('man'), C('man noexiste'), C('more a.txt'), C('less a.txt'), C('history'), C('alias'), C('unalias noexiste'), C('unalias'),
  C('lsblk -d | head -1'), C('df noexiste'), C('umount /mnt'), C('mount /dev/sdb1 /mnt'), C('ip x'), C('ping'), C('ping -c 1 noexiste.invalid'),
  C('nslookup noexiste.invalid'), C('apt install tree'), C('sudo ls'), C('lsmod x'), C('top -n 1 -b | head -1 | cut -c1-5'), C('hostnamectl hostname'),
  C('bash empresa/scripts/informe.sh'), C('cd empresa; bash scripts/informe.sh'), C('bash noexiste.sh'), C("printf 'echo uno\\nls noexiste\\necho dos\\n' > s.sh; bash s.sh"),
  C("printf 'echo \"sin cerrar\\n' > s.sh; bash s.sh"), C('bash -c "echo dentro; exit 4"; echo $?'), C('x=1; bash -c \'echo "[$x]"\''), C('export x=1; bash -c \'echo "[$x]"\''),
  C('./a.txt'), C('empresa/scripts/informe.sh'), C('cd empresa; ./scripts/informe.sh'), C('noexiste'), C('cd..'), C('Ls'),
];
module.exports = { FIXTURE, CASOS };
