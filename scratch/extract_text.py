import pypdf
import os

def extract_pdf_text(pdf_path, txt_path):
    print(f"Extracting {pdf_path} to {txt_path}...")
    reader = pypdf.PdfReader(pdf_path)
    text = ""
    for i, page in enumerate(reader.pages):
        page_text = page.extract_text()
        text += f"\n--- PAGE {i+1} ---\n" + page_text
    
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(text)
    print("Done!")

# Ensure scratch directory exists
os.makedirs("scratch", exist_ok=True)

extract_pdf_text("server/uploads/NEET Grand test .pdf", "scratch/neet_raw.txt")
extract_pdf_text("server/uploads/JEE_Grand_Test (1).pdf", "scratch/jee_raw.txt")
