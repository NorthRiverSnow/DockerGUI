"""仕様のファイルを機械的に点検する。

    python3 check_spec.py --font ~/Library/Fonts/PlemolJP-Regular.ttf docs/spec/*.md
    python3 check_spec.py --boxes-only docs/spec/common.md

点検するのは次の 3 つ。

- 枠のずれ: 枠線の図（┌ から └ まで）の中で、表示幅が違う行
- 幅の分からない字: 枠線の図の中にあって、表示幅を確かめられない字
- 表に無いボタン: 本文には出てくるが、表（| で始まる行）に 1 度も出てこない ［…］

--font を渡すと、表示幅をフォントの字の幅から求める。フォントに無い字を「幅の分からない字」にする。
--font を渡さないと、表示幅を East Asian Width から求める。ASCII 以外の記号を
「幅の分からない字」にする。

問題が 1 件でもあれば、終了コード 1 を返す。
"""

import argparse
import re
import struct
import sys
import unicodedata

BUTTON = re.compile(r"［[^］]*］")
BOX_DRAWING = range(0x2500, 0x2580)


def east_asian_width_of(char):
    return 2 if unicodedata.east_asian_width(char) in "WFA" else 1


def is_unmeasured_symbol(char):
    # why: 記号はフォントにグリフが無いと別のフォントに置き換わり、East Asian Width の
    # 判定と違う幅で描かれる。枠線と ASCII は判定どおりに描かれるので除く。
    if char.isascii() or ord(char) in BOX_DRAWING:
        return False
    return unicodedata.category(char) in ("So", "Sm")


def read_font_widths(path):
    """TrueType の cmap と hmtx を読み、{コードポイント: 半角の何列ぶんか} を返す。"""
    with open(path, "rb") as file:
        font = file.read()

    def u16(offset):
        return struct.unpack(">H", font[offset : offset + 2])[0]

    def u32(offset):
        return struct.unpack(">I", font[offset : offset + 4])[0]

    tables = {
        font[12 + 16 * i : 16 + 16 * i].decode("latin-1"): u32(20 + 16 * i)
        for i in range(u16(4))
    }
    glyph_of = {}
    cmap = tables["cmap"]
    for i in range(u16(cmap + 2)):
        subtable = cmap + u32(cmap + 8 + 8 * i)
        if u16(subtable) == 12:
            for group in range(u32(subtable + 12)):
                first, last, glyph = struct.unpack(
                    ">III", font[subtable + 16 + 12 * group : subtable + 28 + 12 * group]
                )
                for code in range(first, last + 1):
                    glyph_of.setdefault(code, glyph + code - first)
        elif u16(subtable) == 4:
            segments = u16(subtable + 6) // 2
            ends, starts = subtable + 14, subtable + 16 + 2 * segments
            deltas, ranges = starts + 2 * segments, starts + 4 * segments
            for s in range(segments):
                start, end = u16(starts + 2 * s), u16(ends + 2 * s)
                delta, range_offset = u16(deltas + 2 * s), u16(ranges + 2 * s)
                for code in range(start, min(end, 0xFFFE) + 1):
                    if range_offset == 0:
                        glyph = (code + delta) & 0xFFFF
                    else:
                        glyph = u16(ranges + 2 * s + range_offset + 2 * (code - start))
                        glyph = (glyph + delta) & 0xFFFF if glyph else 0
                    if glyph:
                        glyph_of.setdefault(code, glyph)

    metrics_count = u16(tables["hhea"] + 34)

    def advance_of(glyph):
        return u16(tables["hmtx"] + 4 * min(glyph, metrics_count - 1))

    half = advance_of(glyph_of[ord("a")])
    return {code: round(advance_of(glyph) / half, 2) for code, glyph in glyph_of.items()}


def code_blocks_of(lines):
    """(開始行の番号, 行の一覧) を、``` で囲まれた範囲ごとに返す。"""
    blocks, current, start = [], None, 0
    for number, line in enumerate(lines, 1):
        if line.lstrip().startswith("```"):
            if current is None:
                current, start = [], number + 1
            else:
                blocks.append((start, current))
                current = None
        elif current is not None:
            current.append(line)
    return blocks


def boxes_of(block_start, block_lines):
    """(行の番号, 行) の一覧を、┌ の行から └ の行までの枠ごとに返す。"""
    boxes, current = [], None
    for offset, line in enumerate(block_lines):
        if "┌" in line and current is None:
            current = []
        if current is not None:
            current.append((block_start + offset, line))
        if "└" in line and current is not None:
            boxes.append(current)
            current = None
    return boxes


def box_problems_of(lines, font_widths):
    def width_of(char):
        if font_widths is None:
            return east_asian_width_of(char)
        return font_widths.get(ord(char), east_asian_width_of(char))

    def is_unknown_width(char):
        if font_widths is None:
            return is_unmeasured_symbol(char)
        return ord(char) not in font_widths

    problems = []
    for block_start, block_lines in code_blocks_of(lines):
        for box in boxes_of(block_start, block_lines):
            widths = [sum(width_of(c) for c in line.rstrip()) for _, line in box]
            expected = max(set(widths), key=widths.count)
            for (number, line), width in zip(box, widths):
                if width != expected:
                    problems.append(f"{number}: 枠のずれ（幅 {width:g}、枠の他の行は {expected:g}）")
                unknown = sorted({c for c in line if is_unknown_width(c)})
                if unknown:
                    problems.append(f"{number}: 幅の分からない字 {' '.join(unknown)}")
    return problems


def button_problems_of(lines):
    in_tables = {b for line in lines if line.startswith("|") for b in BUTTON.findall(line)}
    problems = []
    for number, line in enumerate(lines, 1):
        for button in BUTTON.findall(line):
            if button not in in_tables:
                problems.append(f"{number}: 表に無いボタン {button}")
                in_tables.add(button)
    return problems


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="+")
    parser.add_argument("--font", help="図を読むときのフォント（.ttf）")
    parser.add_argument("--boxes-only", action="store_true", help="表に無いボタンを点検しない")
    args = parser.parse_args()

    font_widths = read_font_widths(args.font) if args.font else None
    total = 0
    for path in args.files:
        with open(path, encoding="utf-8") as file:
            lines = file.read().split("\n")
        problems = box_problems_of(lines, font_widths)
        if not args.boxes_only:
            problems += button_problems_of(lines)
        total += len(problems)
        print(f"{path}: {len(problems)} 件")
        for problem in problems:
            print(f"  {path}:{problem}")
    sys.exit(1 if total else 0)


if __name__ == "__main__":
    main()
