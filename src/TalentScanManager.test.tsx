import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TalentScanManager from './TalentScanManager';
import { Candidate } from './interfaces';
import { generateCandidatesFromJD } from './sampleData';
import pdfParse from 'pdf-parse';

// Set PDFJS.workerSrc on the global object for pdf-parse
(global as any).PDFJS = { workerSrc: require.resolve('pdfjs-dist/legacy/build/pdf.worker.js') };

// Polyfill for structuredClone in Node.js environments
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

// Mock data for testing
const mockCandidates: Candidate[] = [
  {
    id: '1',
    name: 'John Doe',
    location: 'New York, NY, USA',
    currentRole: 'Senior Customer Success Manager',
    currentCompany: 'Tech Corp',
    score: 8.5,
    experiences: [
      {
        role: 'Customer Success Manager',
        company: 'SaaS Company',
        period: 'Jan 2020 - Present'
      }
    ],
    strengths: ['5+ years experience', 'Strong communication skills'],
    weaknesses: ['Limited technical background'],
    recommendation: 'approve'
  },
  {
    id: '2',
    name: 'Jane Smith',
    location: 'San Francisco, CA, USA',
    currentRole: 'Customer Success Associate',
    currentCompany: 'Startup Inc',
    score: 6.2,
    experiences: [
      {
        role: 'Support Specialist',
        company: 'Help Desk Co',
        period: 'Mar 2019 - Dec 2021'
      }
    ],
    strengths: ['Quick learner', 'Customer focused'],
    weaknesses: ['Limited CS experience', 'No enterprise experience'],
    recommendation: 'hold'
  }
];

async function extractTextFromPDF(filePath: string): Promise<string> {
  const fs = require('fs');
  const data = fs.readFileSync(filePath);
  const result = await pdfParse(data);
  return result.text;
}

describe('TalentScanManager Component', () => {
  const mockOnRecommendationChange = jest.fn();
  const mockOnResumeUpload = jest.fn();

  beforeEach(() => {
    mockOnRecommendationChange.mockClear();
    mockOnResumeUpload.mockClear();
  });

  test('renders header correctly', () => {
    render(
      <TalentScanManager
        candidates={mockCandidates}
        onRecommendationChange={mockOnRecommendationChange}
        onResumeUpload={mockOnResumeUpload}
      />
    );

    expect(screen.getByRole('heading', { name: 'Talent Scan Manager' })).toBeInTheDocument();
    expect(screen.getByText('🎯')).toBeInTheDocument();
  });

  test('renders section headers', () => {
    render(
      <TalentScanManager
        candidates={mockCandidates}
        onRecommendationChange={mockOnRecommendationChange}
        onResumeUpload={mockOnResumeUpload}
      />
    );

    expect(screen.getByText('Candidates')).toBeInTheDocument();
    expect(screen.getByText('Experience')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Shortlist Recommendation - Yes/No')).toBeInTheDocument();
  });

  test('renders candidate information correctly', () => {
    render(
      <TalentScanManager
        candidates={mockCandidates}
        onRecommendationChange={mockOnRecommendationChange}
        onResumeUpload={mockOnResumeUpload}
      />
    );

    // Check first candidate
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText((content, element) => {
      return element?.textContent === '📍 New York, NY, USA';
    })).toBeInTheDocument();
    expect(screen.getByText((content, element) => {
      return element?.textContent === '👤 Senior Customer Success Manager';
    })).toBeInTheDocument();
    expect(screen.getByText((content, element) => {
      return element?.textContent === '🏢 Tech Corp';
    })).toBeInTheDocument();

    // Check second candidate
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText((content, element) => {
      return element?.textContent === '📍 San Francisco, CA, USA';
    })).toBeInTheDocument();
  });

  test('displays candidate scores correctly', () => {
    render(
      <TalentScanManager
        candidates={mockCandidates}
        onRecommendationChange={mockOnRecommendationChange}
        onResumeUpload={mockOnResumeUpload}
      />
    );

    expect(screen.getByText('8.5')).toBeInTheDocument();
    expect(screen.getByText('6.2')).toBeInTheDocument();
  });

  test('renders experience information', () => {
    render(
      <TalentScanManager
        candidates={mockCandidates}
        onRecommendationChange={mockOnRecommendationChange}
        onResumeUpload={mockOnResumeUpload}
      />
    );

    // Use getAllByText to handle multiple instances
    const customerSuccessRoles = screen.getAllByText('Customer Success Manager');
    expect(customerSuccessRoles.length).toBeGreaterThan(0);
    
    expect(screen.getByText('SaaS Company')).toBeInTheDocument();
    expect(screen.getByText('Jan 2020 - Present')).toBeInTheDocument();

    expect(screen.getByText('Support Specialist')).toBeInTheDocument();
    expect(screen.getByText('Help Desk Co')).toBeInTheDocument();
  });

  test('displays strengths and weaknesses', () => {
    render(
      <TalentScanManager
        candidates={mockCandidates}
        onRecommendationChange={mockOnRecommendationChange}
        onResumeUpload={mockOnResumeUpload}
      />
    );

    // Strengths
    expect(screen.getByText('5+ years experience')).toBeInTheDocument();
    expect(screen.getByText('Strong communication skills')).toBeInTheDocument();
    expect(screen.getByText('Quick learner')).toBeInTheDocument();

    // Weaknesses
    expect(screen.getByText('Limited technical background')).toBeInTheDocument();
    expect(screen.getByText('Limited CS experience')).toBeInTheDocument();
  });

  test('renders recommendation buttons with correct initial states', () => {
    render(
      <TalentScanManager
        candidates={mockCandidates}
        onRecommendationChange={mockOnRecommendationChange}
        onResumeUpload={mockOnResumeUpload}
      />
    );

    const approveButtons = screen.getAllByText('Approve');
    const holdButtons = screen.getAllByText('Hold');
    const rejectButtons = screen.getAllByText('Reject');

    expect(approveButtons).toHaveLength(2);
    expect(holdButtons).toHaveLength(2);
    expect(rejectButtons).toHaveLength(2);

    // Check active states
    expect(approveButtons[0]).toHaveClass('active');
    expect(holdButtons[1]).toHaveClass('active');
  });

  test('calls onRecommendationChange when recommendation buttons are clicked', () => {
    render(
      <TalentScanManager
        candidates={mockCandidates}
        onRecommendationChange={mockOnRecommendationChange}
        onResumeUpload={mockOnResumeUpload}
      />
    );

    const holdButtons = screen.getAllByText('Hold');
    fireEvent.click(holdButtons[0]);

    expect(mockOnRecommendationChange).toHaveBeenCalledWith('1', 'hold');
  });

  test('calls onRecommendationChange for reject button', () => {
    render(
      <TalentScanManager
        candidates={mockCandidates}
        onRecommendationChange={mockOnRecommendationChange}
        onResumeUpload={mockOnResumeUpload}
      />
    );

    const rejectButtons = screen.getAllByText('Reject');
    fireEvent.click(rejectButtons[1]);

    expect(mockOnRecommendationChange).toHaveBeenCalledWith('2', 'reject');
  });

  test('handles empty candidates list', () => {
    render(
      <TalentScanManager
        candidates={[]}
        onRecommendationChange={mockOnRecommendationChange}
        onResumeUpload={mockOnResumeUpload}
      />
    );

    expect(screen.getByText('Customer Success Manager')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  test('renders with sample data', () => {
    const jd = 'Customer Success Manager for SaaS company';
    const resumes = [
      'Lucas, Vancouver, Senior Director of Operations, CONNECTIONPOINT SYSTEMS INC',
      'Jackson, Minneapolis, Senior Customer Success, Manager at Relay Systems',
      'Henry, Billings, Customer Success Specialist, PerformYard',
      'Victoria, Colorado Springs, Customer Success Agent, MinistryBrands'
    ];
    const generatedCandidates = generateCandidatesFromJD(jd, resumes);
    render(
      <TalentScanManager
        candidates={generatedCandidates}
        onRecommendationChange={mockOnRecommendationChange}
        onResumeUpload={mockOnResumeUpload}
      />
    );

    expect(screen.getByText('Candidate 1')).toBeInTheDocument();
    expect(screen.getByText('Candidate 2')).toBeInTheDocument();
    expect(screen.getByText('Candidate 3')).toBeInTheDocument();
    expect(screen.getByText('Candidate 4')).toBeInTheDocument();
  });

  describe('Score calculation and display', () => {
    test('getScoreColor returns correct colors for different score ranges', () => {
      const { container } = render(
        <TalentScanManager
          candidates={[
            { ...mockCandidates[0], score: 9.0 }, // High score - green
            { ...mockCandidates[0], id: '2', score: 8.0 }, // Mid score - orange
            { ...mockCandidates[0], id: '3', score: 6.0 } // Low score - red
          ]}
          onRecommendationChange={mockOnRecommendationChange}
          onResumeUpload={mockOnResumeUpload}
        />
      );

      const circles = container.querySelectorAll('.score-progress');
      expect(circles[0]).toHaveAttribute('stroke', '#4CAF50'); // Green
      expect(circles[1]).toHaveAttribute('stroke', '#FF9800'); // Orange
      expect(circles[2]).toHaveAttribute('stroke', '#F44336'); // Red
    });

    test('displays correct score percentages', () => {
      const { container } = render(
        <TalentScanManager
          candidates={[{ ...mockCandidates[0], score: 5.0 }]}
          onRecommendationChange={mockOnRecommendationChange}
          onResumeUpload={mockOnResumeUpload}
        />
      );

      const circle = container.querySelector('.score-progress');
      const strokeDasharray = circle?.getAttribute('stroke-dasharray');
      // 5.0 score = 50% = ~125.5, 251.2 (allowing for floating point precision)
      expect(strokeDasharray).toMatch(/125\.\d+, 251\.2/);
    });
  });

  describe('Component interaction', () => {
    test('multiple button clicks work correctly', () => {
      render(
        <TalentScanManager
          candidates={mockCandidates}
          onRecommendationChange={mockOnRecommendationChange}
          onResumeUpload={mockOnResumeUpload}
        />
      );

      const approveButtons = screen.getAllByText('Approve');
      const holdButtons = screen.getAllByText('Hold');

      fireEvent.click(holdButtons[0]);
      fireEvent.click(approveButtons[1]);

      expect(mockOnRecommendationChange).toHaveBeenCalledTimes(2);
      expect(mockOnRecommendationChange).toHaveBeenNthCalledWith(1, '1', 'hold');
      expect(mockOnRecommendationChange).toHaveBeenNthCalledWith(2, '2', 'approve');
    });
  });

  describe('Accessibility', () => {
    test('buttons are accessible', () => {
      render(
        <TalentScanManager
          candidates={mockCandidates}
          onRecommendationChange={mockOnRecommendationChange}
          onResumeUpload={mockOnResumeUpload}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(6); // 3 buttons × 2 candidates

      buttons.forEach(button => {
        expect(button).toBeEnabled();
      });
    });

    test('component has proper structure', () => {
      render(
        <TalentScanManager
          candidates={mockCandidates}
          onRecommendationChange={mockOnRecommendationChange}
          onResumeUpload={mockOnResumeUpload}
        />
      );

      expect(screen.getByRole('banner')).toBeInTheDocument(); // header
      expect(screen.getAllByRole('button')).toHaveLength(6);
    });
  });

  describe('Error handling', () => {
    test('handles missing optional fields gracefully', () => {
      const incompleteCandidate: Candidate = {
        id: '1',
        name: 'Incomplete Candidate',
        location: 'Unknown',
        currentRole: 'Role',
        currentCompany: 'Company',
        score: 7.0,
        experiences: [],
        strengths: [],
        weaknesses: [],
        recommendation: 'hold'
      };

      render(
        <TalentScanManager
          candidates={[incompleteCandidate]}
          onRecommendationChange={mockOnRecommendationChange}
          onResumeUpload={mockOnResumeUpload}
        />
      );

      expect(screen.getByText('Incomplete Candidate')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('renders large number of candidates efficiently', () => {
      const largeCandidateList = Array.from({ length: 50 }, (_, index) => ({
        ...mockCandidates[0],
        id: `candidate-${index}`,
        name: `Candidate ${index}`,
        score: Math.random() * 10
      }));

      const startTime = performance.now();
      render(
        <TalentScanManager
          candidates={largeCandidateList}
          onRecommendationChange={mockOnRecommendationChange}
          onResumeUpload={mockOnResumeUpload}
        />
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should render in less than 1 second
      expect(screen.getByText('Candidate 0')).toBeInTheDocument();
      expect(screen.getByText('Candidate 49')).toBeInTheDocument();
    });
  });
});

describe('generateCandidatesFromJD', () => {
  it('extracts correct candidate name for HariBabu.pdf text', () => {
    const resumeText = `Hari Babu Kariprolu\nEmail: kariproluhari@gmail.com | Mobile: +91 9398677813 | LinkedIn: [https://www.linkedin.com/in/hari-babu-2b45b915a/]\nProfessional Summary\n● 9.4+ years of experience in Software Development, specializing in Restful web services, distributed web applications and API integrations.`;
    const jd = 'Must Have: Golang\nNice to Have: Microservices';
    const candidates = generateCandidatesFromJD(jd, [resumeText]);
    expect(candidates[0].name).toBe('Hari Babu Kariprolu');
  });

  it('extracts correct location for Ravinder Kumar', () => {
    const resumeText = `Software Engineer with over 4.5+ years of expertise in building web
applications and backend systems using Laravel, PHP, Golang, Vuejs. Skilled
in crafting clear, maintainable code, scalable API development, 
Module Lead
Bluelupin Technologies Private limited
01/2022 - 10/2023
Noida
SUMMARY
PROFESSIONAL EXPERIENCE
SKILLS
STRENGTHS 
EDUCATION
RK
RAVINDER KUMAR
Software Engineer
9818720984 rav45200@gmail.com
https://www.linkedin.com/in/ravinder-kumar-a4b954166
Faridabad`;
    const jd = 'Must Have: Golang\nNice to Have: Microservices';
    const candidates = generateCandidatesFromJD(jd, [resumeText]);
    expect(candidates[0].name).toBe('RAVINDER KUMAR');
    expect(candidates[0].location).toBe('Faridabad');
  });

  it('extracts correct location for Protik Biswas', () => {
    const resumeText = `Protik Biswas 
Senior Software Engineer with 7 
years of experience 
4306, Prestige High fields Apartment 
Nanakadamguda, Hyderabad 500032 
+91 970 435 0092 
protikbiswas100@gmail.com`;
    const jd = 'Must Have: Golang\nNice to Have: Microservices';
    const candidates = generateCandidatesFromJD(jd, [resumeText]);
    expect(candidates[0].name).toBe('Protik Biswas');
    expect(candidates[0].location).toBe('Hyderabad');
  });
});

describe('PDF candidate name extraction', () => {
  const jd = 'Must Have: Golang\nNice to Have: Microservices';
  
  // Pre-extracted text content from actual PDFs to avoid timeout issues
  const textTests = [
         {
       name: 'HariBabu.pdf',
       text: `Hari Babu Kariprolu 
Email: kariproluhari@gmail.com | Mobile: +91 9398677813| 
LinkedIn: [https://www.linkedin.com/in/hari-babu-2b45b915a/] 
 
Professional Summary 
● 9.4+  years of  experience  in  Software  Development, specializing  in  Restful web services,  distributed
web applications and API integrations.`,
       expected: 'Hari Babu Kariprolu'
     },
     {
       name: 'KomalRavindraKadam.pdf',
       text: `Komal Kadam

+91-9158173535|#komal.kadam2@cognizant.com|ïkomalkadam2202
SENIOR FRONTEND DEVELOPER
Dedicated Frontend Developer with5+ yearsof professional experience. Proficient in Angular and MEAN technologies.`,
       expected: 'Komal Kadam'
     },
     {
       name: 'Protik Biswas.pdf',
       text: `Protik Biswas 
Senior Software Engineer with 7 
years of experience 
4306, Prestige High fields Apartment 
Nanakadamguda, Hyderabad 500032 
+91 970 435 0092 
protikbiswas100@gmail.com`,
       expected: 'Protik Biswas',
       expectedLocation: 'Hyderabad'
     },
         {
       name: 'RavinderKumar.pdf',
       text: `Software Engineer with over 4.5+ years of expertise in building web
applications and backend systems using Laravel, PHP, Golang, Vuejs. Skilled
in crafting clear, maintainable code, scalable API development, 
Module Lead
Bluelupin Technologies Private limited
01/2022 - 10/2023
Noida
SUMMARY
PROFESSIONAL EXPERIENCE
SKILLS
STRENGTHS 
EDUCATION
RK
RAVINDER KUMAR
Software Engineer
9818720984 rav45200@gmail.com
https://www.linkedin.com/in/ravinder-kumar-a4b954166
Faridabad`,
       expected: 'RAVINDER KUMAR',
       expectedLocation: 'Faridabad'
     }
  ];

     textTests.forEach(({ name, text, expected, expectedLocation }) => {
     it(`extracts correct candidate name for ${name}`, () => {
       const candidates = generateCandidatesFromJD(jd, [text]);
       expect(candidates[0].name).toBe(expected);
       if (expectedLocation) {
         expect(candidates[0].location).toBe(expectedLocation);
       }
     });
   });

  // Keep one actual PDF test but with a much longer timeout as integration test
  const pdfTests = [
    { file: 'sample-resumes/HariBabu.pdf', expected: 'Hari Babu Kariprolu' },
  ];

  pdfTests.forEach(({ file, expected }) => {
    it(`extracts correct candidate name for actual ${file}`, async () => {
      const resumeText = await extractTextFromPDF(file);
      const candidates = generateCandidatesFromJD(jd, [resumeText]);
      expect(candidates[0].name).toBe(expected);
    }, 60000); // 60 second timeout for single PDF integration test
  });
});