import io
import email
from email import policy
import base64
from typing import Optional, List
from pydantic import BaseModel
import pdfplumber
from pdf2image import convert_from_bytes
from PIL import Image
from app.utils.logger import setup_logger
from app.config import settings

logger = setup_logger("file_parser")

class ParsedDocument(BaseModel):
    text: Optional[str] = None
    images_base64: List[str] = []
    page_count: int = 1
    file_type: str

def parse_pdf(file_bytes) -> ParsedDocument:
    """Extracts text and images from a PDF file."""
    text_content = ""
    images_base64 = []
    page_count = 0

    try:
        # Extract text using pdfplumber
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            page_count = len(pdf.pages)
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text(layout=True)
                if page_text:
                    text_content += f"\n--- Page {i+1} ---\n{page_text}"

        # If no text was found (scanned PDF), convert to images for vision processing

        if not text_content.strip() and settings.EXTRACT_IMAGES:
            logger.info("No text extracted from PDF, attempting image extraction...")
            try:
                images = convert_from_bytes(file_bytes)
                for img in images:
                    buffered = io.BytesIO()
                    img.save(buffered, format="JPEG")
                    img_Str = base64.b64encode(buffered.getvalue()).decode("utf-8")
                    images_base64.append(f"data:image/jpeg;base64,{img_Str}")
            except Exception as img_err:
                logger.warning(f"Could not extract images from PDF (is poppler installed?): {img_err}")
        
        return ParsedDocument(
            text=text_content.strip() if text_content.strip() else None,
            images_base64=images_base64,
            page_count=page_count,
            file_type="pdf",
            
        )
    except Exception as e:
        logger.error(f"Error parsing PDF: {str(e)}")
        raise ValueError(f"Error parsing PDF: {str(e)}")


def parse_image(file_bytes: bytes, filename: str) -> ParsedDocument:
    """Validates an image and converts it to base64."""
    try:
        # Pillow's verify() exhausts the file handle, so open a fresh copy just for validation
        try:
            verify_img = Image.open(io.BytesIO(file_bytes))
            verify_img.verify()
        except Exception:
            raise ValueError("Invalid or corrupted image file")

        # Determine format for the base64 prefix
        ext = filename.split(".")[-1].lower()
        mime_type = "image/jpeg" if ext in ["jpg", "jpeg"] else f"image/{ext}"

        img_str = base64.b64encode(file_bytes).decode("utf-8")

        return ParsedDocument(
            text=None,
            images_base64=[f"data:{mime_type};base64,{img_str}"],
            page_count=1,
            file_type="image"
        )
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Failed to parse image: {str(e)}")
        raise ValueError("Invalid or corrupted image file")


def parse_email(file_bytes: bytes) -> ParsedDocument:
    """Parses an .eml file and extracts headers and body."""
    try:
        msg = email.message_from_bytes(file_bytes, policy=policy.default)
        
        text_content = f"Subject: {msg.get('subject', 'No Subject')}\n"
        text_content += f"From: {msg.get('from', 'Unknown')}\n"
        text_content += f"To: {msg.get('to', 'Unknown')}\n"
        text_content += f"Date: {msg.get('date', 'Unknown')}\n\n"
        
        # Get the body
        body = msg.get_body(preferencelist=('plain', 'html'))
        if body:
            text_content += body.get_content()
            
        return ParsedDocument(
            text=text_content.strip(),
            file_type="email"
        )
    except Exception as e:
        logger.error(f"Failed to parse email: {str(e)}")
        raise ValueError("Invalid or corrupted .eml file")
def parse_text(file_bytes: bytes) -> ParsedDocument:
    """Parses plain text files."""
    try:
        # Try UTF-8 first, fallback to latin-1
        try:
            text = file_bytes.decode('utf-8')
        except UnicodeDecodeError:
            text = file_bytes.decode('latin-1')
            
        return ParsedDocument(
            text=text,
            file_type="text"
        )
    except Exception as e:
        logger.error(f"Failed to parse text file: {str(e)}")
        raise ValueError("Invalid text file format")
def parse_file(file_bytes: bytes, filename: str, content_type: str) -> ParsedDocument:
    """Main entry point for parsing any supported file."""
    
    # 1. Size Check
    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > settings.MAX_FILE_SIZE_MB:
        logger.warning(f"File {filename} rejected: Size {size_mb:.2f}MB exceeds limit.")
        raise ValueError(f"File too large. Maximum allowed size is {settings.MAX_FILE_SIZE_MB}MB.")
    logger.info(f"Parsing file: {filename} ({content_type}), Size: {size_mb:.2f}MB")
    
    # 2. Routing based on extension/content_type
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    
    if ext == "pdf" or "pdf" in content_type:
        return parse_pdf(file_bytes)
        
    elif ext in ["jpg", "jpeg", "png", "bmp", "tiff"] or "image" in content_type:
        return parse_image(file_bytes, filename)
        
    elif ext in ["eml", "msg"] or "message" in content_type:
        return parse_email(file_bytes)
        
    elif ext in ["txt", "md", "json"] or "text" in content_type:
        return parse_text(file_bytes)
        
    else:
        logger.warning(f"Unsupported file type uploaded: {filename}")
        raise ValueError(f"Unsupported file type: {ext or content_type}")
