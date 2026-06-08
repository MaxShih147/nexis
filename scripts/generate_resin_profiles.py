import json
import os
import re
import sys
from xml.etree import ElementTree as ET


def slugify(name: str) -> str:
    name = name.strip().lower()
    name = re.sub(r"[^a-z0-9]+", "_", name)
    name = re.sub(r"_+", "_", name).strip("_")
    return name or "unknown"


def get_text(elem, tag, default=None):
    child = elem.find(tag)
    if child is None or child.text is None:
        return default
    return child.text.strip()


def get_num(elem, tag, default=None):
    txt = get_text(elem, tag, None)
    if txt is None:
        return default
    try:
        if re.fullmatch(r"[-+]?\d+", txt):
            return int(txt)
        return float(txt)
    except Exception:
        return default


def parse_compensate_size(exposure_el):
    comp = exposure_el.find("CompensateSize")
    if comp is None:
        return None
    def block(el):
        if el is None:
            return None
        return {
            "in": get_num(el, "CompensateSizeIn", 0.0),
            "in_base": get_num(el, "CompensateSizeInBase", 0.0),
            "out": get_num(el, "CompensateSizeOut", 0.0),
            "out_base": get_num(el, "CompensateSizeOutBase", 0.0),
        }
    return {
        "default": block(comp.find("Default")),
        "customize": block(comp.find("Customize")),
    }


def text_block(elem, tag):
    node = elem.find(tag)
    if node is None or node.text is None:
        return None
    # Normalize whitespace but preserve newlines
    text = "\n".join(line.rstrip() for line in node.text.splitlines()).strip()
    return text


def parse_exposure(exposure_el):
    ratio_el = exposure_el.find("Ratio")
    return {
        "mode": get_text(exposure_el, "ThicknessName"),  # e.g., stable/fast/customize
        "thickness_mm": get_num(exposure_el, "Thickness"),
        "ratio": {
            "x": get_num(ratio_el if ratio_el is not None else exposure_el, "RatioX", 1.0),
            "y": get_num(ratio_el if ratio_el is not None else exposure_el, "RatioY", 1.0),
            "z": get_num(ratio_el if ratio_el is not None else exposure_el, "RatioZ", 1.0),
        },
        "two_stage": get_num(exposure_el, "TwoStage", 0),
        # Motion and timing parameters
        "base_layers": get_num(exposure_el, "NumBaseLayer"),
        "base_curing_time": get_num(exposure_el, "BaseCuringTime"),
        "base_lift_height": get_num(exposure_el, "BaseLiftHeight"),
        "normal_curing_time": get_num(exposure_el, "NormalCuringTime"),
        "normal_wait_before_print": get_num(exposure_el, "NormalWaitBeforePrint"),
        "normal_wait_after_print": get_num(exposure_el, "NormalWaitAfterPrint"),
        "normal_wait_lift": get_num(exposure_el, "NormalWaitLift"),
        "normal_lift_height": get_num(exposure_el, "NormalLiftHeight"),
        "base_peel_speed": get_num(exposure_el, "BasePeelSpeed"),
        "base_return_speed": get_num(exposure_el, "BaseReturnSpeed"),
        "normal_peel_speed": get_num(exposure_el, "NormalPeelSpeed"),
        "normal_return_speed": get_num(exposure_el, "NormalReturnSpeed"),
        "buffer_layer_number": get_num(exposure_el, "BufferLayerNumber"),
        # Light and PWM
        "light_pwm": get_num(exposure_el, "ligthPwmInputFile"),
        "bottom_light_pwm": get_num(exposure_el, "bottomLigthPwmInputFile"),
        # Second stage distances/speeds (optional)
        "bottom_retract_dist": get_num(exposure_el, "bottomRetractDistInputFile"),
        "bottom_lift_second_dist": get_num(exposure_el, "bottomLiftSecondDistInputFile"),
        "bottom_lift_second_speed": get_num(exposure_el, "bottomLiftSecondSpeedInputFile"),
        "bottom_retract_second_dist": get_num(exposure_el, "bottomRetractSecondDistInputFile"),
        "bottom_retract_second_speed": get_num(exposure_el, "bottomRetractSecondSpeedInputFile"),
        "retract_dist": get_num(exposure_el, "retractDistInputFile"),
        "lift_second_dist": get_num(exposure_el, "liftSecondDistInputFile"),
        "lift_second_speed": get_num(exposure_el, "liftSecondSpeedInputFile"),
        "retract_second_dist": get_num(exposure_el, "retractSecondDistInputFile"),
        "retract_second_speed": get_num(exposure_el, "retractSecondSpeedInputFile"),
        # Advanced flags
        "rotate_para": get_num(exposure_el, "RotatePara"),
        "grayscale_level": get_num(exposure_el, "grayScaleLevelInputFile"),
        "timelapse": {
            "enabled": get_num(exposure_el, "timeLapseSwitchFile"),
            "interval_layers": get_num(exposure_el, "timeLapseIntervalLayersFile"),
            "move_speed": get_num(exposure_el, "timeLapseMoveSpeedFile"),
        },
        "exposure_delay_mode": get_num(exposure_el, "exposureDelayModeFile"),
        "turn_off_time": get_num(exposure_el, "turnOffTimeInputFile"),
        "advance_mode": get_num(exposure_el, "advanceModeFile"),
        # GCODE blocks
        "gcode": {
            "start": text_block(exposure_el, "GCODEStart"),
            "mid": text_block(exposure_el, "GCODEMid"),
            "end": text_block(exposure_el, "GCODEEnd"),
        },
        # Compensation
        "compensate_size": parse_compensate_size(exposure_el),
    }


def parse_thickness_config(tc_el):
    return {
        "thickness_display": get_text(tc_el, "ThicknessName"),  # e.g., "30 um"
        "thickness_mm": get_num(tc_el, "Thickness"),
        "modes": [parse_exposure(ed) for ed in tc_el.findall("ExposureData")],
    }


def parse_resin_config(rc_el):
    return {
        "brand_name": get_text(rc_el, "BrandName"),
        "resin_name": get_text(rc_el, "ResinName"),
        "printer_brand": get_text(rc_el, "PrinterBrand"),
        "printer_name": get_text(rc_el, "PrinterName"),
        "export_type": get_num(rc_el, "ExportType"),
        "dimensions": {
            "x": get_num(rc_el, "DimensionX"),
            "y": get_num(rc_el, "DimensionY"),
            "z": get_num(rc_el, "DimensionZ"),
        },
        "image_mirror": get_num(rc_el, "ImageMirror"),
        "resolution": {
            "x": get_num(rc_el, "ResolutionX"),
            "y": get_num(rc_el, "ResolutionY"),
        },
        "margin_buffer": {
            "x": get_num(rc_el, "MarginBufferX"),
            "y": get_num(rc_el, "MarginBufferY"),
        },
        "thickness_configs": [parse_thickness_config(tc) for tc in rc_el.findall("ThicknessConfig")],
    }


def main():
    if len(sys.argv) < 3:
        print("Usage: python scripts/generate_resin_profiles.py <xml_path> <output_dir>")
        sys.exit(1)

    xml_path = sys.argv[1]
    out_dir = sys.argv[2]

    # Parse XML (handle BOM by opening in binary)
    with open(xml_path, "rb") as f:
        data = f.read()
    # xml.etree can handle BOM; parse from bytes
    root = ET.fromstring(data)

    printing_params = root.find("PrintingParameters")
    if printing_params is None:
        raise RuntimeError("Missing <PrintingParameters> in XML")
    printer_configs = printing_params.findall("PrinterConfig")
    if not printer_configs:
        raise RuntimeError("Missing <PrinterConfig> in XML")

    grouped = {}
    for pc_el in printer_configs:
        for rc_el in pc_el.findall("ResinConfig"):
            profile = parse_resin_config(rc_el)
            printer_name = profile.get("printer_name") or "Unknown"
            grouped.setdefault(printer_name, []).append(profile)
        # Ensure we create a file even if only a <Group> (no ResinConfig)
        group_el = pc_el.find("Group")
        if group_el is not None:
            g_printer = get_text(group_el, "PrinterName")
            if g_printer:
                grouped.setdefault(g_printer, [])

    os.makedirs(out_dir, exist_ok=True)

    index = {}
    for printer_name, profiles in grouped.items():
        slug = slugify(printer_name)
        file_path = os.path.join(out_dir, f"{slug}.json")
        payload = {
            "printer_name": printer_name,
            "profiles": profiles,
        }
        with open(file_path, "w", encoding="utf-8") as jf:
            json.dump(payload, jf, ensure_ascii=False, indent=2)
        index[printer_name] = {
            "slug": slug,
            "file": f"{slug}.json",
            "profile_count": len(profiles),
        }

    # Write an index.json for convenience
    with open(os.path.join(out_dir, "index.json"), "w", encoding="utf-8") as jf:
        json.dump(index, jf, ensure_ascii=False, indent=2)

    print(json.dumps({"printers": index}, ensure_ascii=False))


if __name__ == "__main__":
    main()
