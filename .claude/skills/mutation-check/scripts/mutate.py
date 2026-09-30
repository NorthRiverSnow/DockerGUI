"""実装を 1 か所だけ壊し、テストを実行して、壊した判断をテストが守っているかを確かめる。

使い方: python3 mutate.py <ファイル> <壊す前の文字列> <壊した後の文字列> <名前> <退避先のフォルダ>

壊す前の文字列は、ファイルの中にちょうど 1 回だけ出てくるものにする。
テストが失敗すれば KILLED（守っている）、通れば SURVIVED（守っていない）と書く。
どちらでも、最後にファイルを元に戻す。
"""

import pathlib
import shutil
import subprocess
import sys

path, before, after, label, backup_dir = sys.argv[1:6]
target = pathlib.Path(path)
backup = pathlib.Path(backup_dir) / (target.name + ".bak")
shutil.copy(target, backup)
try:
    text = target.read_text()
    count = text.count(before)
    if count != 1:
        print(f"SKIPPED  {label}（壊す前の文字列が {count} 回出てくる）")
        sys.exit(0)
    target.write_text(text.replace(before, after))
    result = subprocess.run(["vp", "test", "run", "src"], capture_output=True, text=True, timeout=180)
    print(("KILLED   " if result.returncode != 0 else "SURVIVED ") + label)
except subprocess.TimeoutExpired:
    print(f"KILLED   {label}（時間切れ）")
finally:
    shutil.copy(backup, target)
    backup.unlink()
