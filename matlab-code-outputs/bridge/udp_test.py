import subprocess
import re

def start_universal_bridge():
    cmd = ["sudo", "tcpdump", "-i", "wls6", "udp port", "5005", "-l", "-A"]
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, text=True, errors='ignore')

    print("Čekám na JSON/Text z Matlabu...")

    for line in process.stdout:
        # Hledáme cokoli, co vypadá jako JSON (začíná { )
        match = re.search(r'(\{.*\})', line)
        if match:
            raw_json = match.group(1)
            print(f"✅ ZACHYCEN JSON: {raw_json}")
        
        elif "length" not in line and line.strip():
            clean_text = "".join(c for c in line if 32 <= ord(c) <= 126)
            if len(clean_text) > 2:
                print(f"Zachycen text: {clean_text}")

try:
    start_universal_bridge()
except KeyboardInterrupt:
    print("Ukončeno.")