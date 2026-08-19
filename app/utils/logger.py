import logging
import sys

def setup_logger(name: str) -> logging.Logger:
    """Configures and returns a structured logger."""
    logger = logging.getLogger(name)
    
    # Only configure if it doesn't already have handlers to avoid duplicates
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        
        # Create console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        
        # Create formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        # Add formatter to console handler
        console_handler.setFormatter(formatter)
        
        # Add console handler to logger
        logger.addHandler(console_handler)
        
    return logger
