import { Candidate } from './interfaces';

// Function to generate candidates from JD and resume texts
export function generateCandidatesFromJD(jd: string, resumes: string[]): Candidate[] {
  // Extract must-have and nice-to-have skills from JD string
  const mustHaveMatch = jd.match(/Must Have:\s*(.*)/i);
  const niceToHaveMatch = jd.match(/Nice to Have:\s*(.*)/i);
  const mustHaveSkills = mustHaveMatch ? mustHaveMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [];
  const niceToHaveSkills = niceToHaveMatch ? niceToHaveMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [];
  const allSkills = [...mustHaveSkills, ...niceToHaveSkills];

  // Scoring weights
  const mustHaveWeight = 3;
  const niceToHaveWeight = 1;
  const maxScore = (mustHaveSkills.length * mustHaveWeight) + (niceToHaveSkills.length * niceToHaveWeight);

  return resumes.map((resume, idx) => {
    const lines = resume.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let candidateName = 'Unknown';
    
    // Enhanced name extraction function
    const extractName = () => {
             // Strategy 1: Check first 5 lines for common name patterns
       for (let i = 0; i < Math.min(5, lines.length); i++) {
         const line = lines[i];
         
         // Skip obvious non-name lines
         if (/email|mobile|phone|\+\d{1,3}|@|linkedin|http|summary|experience|engineer|developer|manager|module|lead|senior|junior|associate|specialist|analyst|coordinator|director|consultant|architect|backend|frontend|full|stack|team|project|product|quality|assurance|business|data|scientist|administrator|supervisor|assistant|executive|operations|marketing|sales|finance|human|resources|legal|accounting|support|customer|success|service|representative|intern|trainee|vice|president|chief|officer|head|principal|staff|solutions|systems|network|database|security|devops|cloud|mobile|web|application|platform|infrastructure|technology|information|science|research|innovation|strategy|growth|acquisition|retention/i.test(line)) {
           continue;
         }
         
         const words = line.split(/\s+/);
         
         // Check for 2-4 word names with proper capitalization
         if (words.length >= 2 && words.length <= 4 && line.length < 50) {
           // Pattern 1: Title case names (John Smith, Hari Babu Kariprolu)
           if (words.every(w => /^[A-Z][a-z]+$/.test(w))) {
             candidateName = line;
             return candidateName;
           }
           
           // Pattern 2: All caps names (RAVINDER KUMAR)
           if (words.every(w => /^[A-Z]+$/.test(w) && w.length >= 2)) {
             candidateName = line;
             return candidateName;
           }
           
           // Pattern 3: Mixed case (John SMITH)
           if (words.every(w => /^[A-Z][A-Za-z]+$/.test(w))) {
             candidateName = line;
             return candidateName;
           }
         }
       }
      
      // Strategy 2: Look for name patterns throughout the text
      const fullText = resume.replace(/\n/g, ' ').trim();
      
      // Look for "RK RAVINDER KUMAR" pattern (initials followed by full name)
      const initialsNamePattern = /\b[A-Z]{1,3}\s+([A-Z]+(?:\s+[A-Z]+)+)\b/g;
      let match = initialsNamePattern.exec(fullText);
      if (match) {
        const potentialName = match[1].trim();
        const words = potentialName.split(/\s+/);
        if (words.length >= 2 && words.length <= 4 && words.every(w => w.length >= 2)) {
          candidateName = potentialName;
          return candidateName;
        }
      }
      
      // Strategy 3: Look for standalone full names (ALL CAPS)
      const allCapsNamePattern = /\b([A-Z]{2,}\s+[A-Z]{2,}(?:\s+[A-Z]{2,})?)\b/g;
      match = allCapsNamePattern.exec(fullText);
      if (match) {
        const potentialName = match[1].trim();
        const words = potentialName.split(/\s+/);
        if (words.length >= 2 && words.length <= 4 && 
            !/(SUMMARY|EXPERIENCE|SKILLS|EDUCATION|PROFESSIONAL|SOFTWARE|ENGINEER|DEVELOPER|MANAGER|TECHNICAL)/i.test(potentialName)) {
          candidateName = potentialName;
          return candidateName;
        }
      }
      
      // Strategy 4: Look for title case names throughout text
      const titleCaseNamePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;
      while ((match = titleCaseNamePattern.exec(fullText)) !== null) {
        const potentialName = match[1].trim();
        const words = potentialName.split(/\s+/);
        if (words.length >= 2 && words.length <= 4 && potentialName.length < 50 &&
            !/(Email|Mobile|LinkedIn|Summary|Experience|Skills|Education|Professional|Software|Engineer|Developer|Manager|Technical|Years|Building|Expertise|Module|Lead|Senior|Junior|Associate|Specialist|Analyst|Coordinator|Director|Consultant|Architect|Backend|Frontend|Full|Stack|Team|Project|Product|Quality|Assurance|Business|Data|Scientist|Administrator|Supervisor|Assistant|Executive|Operations|Marketing|Sales|Finance|Human|Resources|Legal|Accounting|Support|Customer|Success|Service|Representative|Intern|Trainee|Vice|President|Chief|Officer|Head|Principal|Staff|Solutions|Systems|Network|Database|Security|DevOps|Cloud|Mobile|Web|Application|Platform|Infrastructure|Technology|Information|Science|Research|Innovation|Strategy|Growth|Acquisition|Retention)/i.test(potentialName)) {
          candidateName = potentialName;
          return candidateName;
        }
      }
      
      return candidateName;
    };
    
    candidateName = extractName();
    
    // Fallback: use first line if nothing found
    if (candidateName === 'Unknown' && lines.length > 0) {
      candidateName = lines[0];
    }

    // Extract location
    const extractLocation = () => {
      // Strategy 1: Look for common Indian cities
      const indianCities = [
        'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad', 
        'Surat', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam',
        'Pimpri', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad', 'Meerut',
        'Rajkot', 'Kalyan', 'Vasai', 'Varanasi', 'Srinagar', 'Aurangabad', 'Dhanbad', 'Amritsar',
        'Navi Mumbai', 'Allahabad', 'Ranchi', 'Howrah', 'Coimbatore', 'Jabalpur', 'Gwalior', 'Vijayawada',
        'Jodhpur', 'Madurai', 'Raipur', 'Kota', 'Guwahati', 'Chandigarh', 'Solapur', 'Hubballi', 'Tiruchirappalli',
        'Bareilly', 'Mysore', 'Tiruppur', 'Gurgaon', 'Aligarh', 'Jalandhar', 'Bhubaneswar', 'Salem',
        'Warangal', 'Guntur', 'Bhiwandi', 'Saharanpur', 'Gorakhpur', 'Bikaner', 'Amravati', 'Noida'
      ];
      
      // Strategy 2: Look for city names in the text
      const fullText = resume.toLowerCase();
      for (const city of indianCities) {
        if (fullText.includes(city.toLowerCase())) {
          // Check context to make sure it's a location, not company name
          const cityIndex = fullText.indexOf(city.toLowerCase());
          const context = resume.substring(Math.max(0, cityIndex - 50), cityIndex + city.length + 50);
          
          // Skip if it's part of company name or in professional context
          if (!context.toLowerCase().includes('technologies') &&
              !context.toLowerCase().includes('company') &&
              !context.toLowerCase().includes('ltd') &&
              !context.toLowerCase().includes('private limited') &&
              !context.toLowerCase().includes('corporation') &&
              !context.toLowerCase().includes('solutions')) {
            return city;
          }
        }
      }
      
      // Strategy 3: Look for location patterns in lines
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip lines that are too short or too long
        if (line.length < 3 || line.length > 100) continue;
        
        // Skip obvious non-location lines
        if (/email|mobile|phone|\+\d{1,3}|@|linkedin|http|summary|experience|engineer|developer|manager|skills|education|professional|years|expertise|building|software/i.test(line)) {
          continue;
        }
        
        // Look for standalone city names (single word locations)
        const words = line.split(/\s+/);
        if (words.length === 1 && words[0].length >= 4) {
          const word = words[0];
          // Check if it matches known cities
          const matchedCity = indianCities.find(city => city.toLowerCase() === word.toLowerCase());
          if (matchedCity) {
            return matchedCity;
          }
        }
        
        // Look for "City, State" patterns
        const locationPattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)?$/;
        if (locationPattern.test(line.trim()) && !line.toLowerCase().includes('university') && !line.toLowerCase().includes('college')) {
          return line.trim();
        }
      }
      
      return 'Unknown';
    };

    const candidateLocation = extractLocation();

    // Find matched and missing skills
    const matchedMustHave = mustHaveSkills.filter(skill => skill && new RegExp(skill, 'i').test(resume));
    const matchedNiceToHave = niceToHaveSkills.filter(skill => skill && new RegExp(skill, 'i').test(resume));
    const matchedSkills = [...matchedMustHave, ...matchedNiceToHave];
    const missingSkills = allSkills.filter(skill => skill && !new RegExp(skill, 'i').test(resume));

    // Improved experience parsing: look for blocks of [Role] then [Company] | [Period]
    const experiences = [];
    for (let i = 0; i < lines.length - 1; i++) {
      // Role line followed by Company | Period line
      const roleLine = lines[i];
      const companyPeriodLine = lines[i + 1];
      const companyPeriodMatch = companyPeriodLine.match(/([A-Za-z0-9 .,&\-|]+)\s*[|\-]\s*([A-Za-z0-9 ,]+\d{4}(?:\s*-\s*(?:Present|[A-ZaZ]+ \d{4}))?)/);
      if (companyPeriodMatch) {
        experiences.push({
          role: roleLine,
          company: companyPeriodMatch[1].trim(),
          period: companyPeriodMatch[2].trim()
        });
      }
    }

    // Calculate score
    const scoreRaw = (matchedMustHave.length * mustHaveWeight) + (matchedNiceToHave.length * niceToHaveWeight);
    const score = maxScore > 0 ? Math.round((scoreRaw / maxScore) * 10 * 10) / 10 : 0; // 1 decimal, scale 0-10

    return {
      id: String(idx + 1),
      name: candidateName,
      location: candidateLocation,
      currentRole: experiences[0]?.role || 'Unknown',
      currentCompany: experiences[0]?.company || 'Unknown',
      score,
      experiences,
      strengths: matchedSkills.length > 0 ? matchedSkills : ['No skills matched'],
      weaknesses: missingSkills.length > 0 ? missingSkills : ['None'],
      recommendation: 'approve'
    };
  });
}