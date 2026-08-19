from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.base import BaseExtractionResult

class WorkExperience(BaseModel):
    company_name: str = Field(description="Name of the company.")
    job_title: str = Field(description="Job title or role.")
    start_date: Optional[str] = Field(default=None, description="Start date of employment.")
    end_date: Optional[str] = Field(default=None, description="End date of employment. Leave empty if currently employed.")
    responsibilities: List[str] = Field(default_factory=list, description="List of key responsibilities or achievements.")

class Education(BaseModel):
    institution_name: str = Field(description="Name of the university, college, or school.")
    degree: Optional[str] = Field(default=None, description="Degree or certification obtained (e.g., BSc Computer Science).")
    graduation_date: Optional[str] = Field(default=None, description="Date of graduation.")

class Skill(BaseModel):
    name: str = Field(description="Name of the skill (e.g., Python, Project Management).")
    category: Optional[str] = Field(default=None, description="Category of the skill (e.g., Technical, Soft Skill).")

class Certification(BaseModel):
    name: str = Field(description="Name of the certification.")
    issuer: Optional[str] = Field(default=None, description="Organization that issued the certification.")
    date_issued: Optional[str] = Field(default=None, description="Date the certification was issued.")

class ResumeData(BaseExtractionResult):
    full_name: Optional[str] = Field(default=None, description="Full name of the candidate.")
    email: Optional[str] = Field(default=None, description="Email address.")
    phone: Optional[str] = Field(default=None, description="Phone number.")
    location: Optional[str] = Field(default=None, description="City, State, or Country of residence.")
    linkedin_url: Optional[str] = Field(default=None, description="URL to the candidate's LinkedIn profile.")
    summary: Optional[str] = Field(default=None, description="A brief professional summary or objective.")
    
    skills: List[Skill] = Field(default_factory=list, description="List of skills.")
    experience: List[WorkExperience] = Field(default_factory=list, description="List of work experiences.")
    education: List[Education] = Field(default_factory=list, description="List of educational background.")
    certifications: List[Certification] = Field(default_factory=list, description="List of certifications.")
