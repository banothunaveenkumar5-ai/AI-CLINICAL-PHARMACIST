import React, { useState, useCallback, useRef, useEffect } from 'react';
import { analyzeHealthDocument, analyzeHealthText } from './services/geminiService';
import type { AnalysisResult, PotentialError } from './types';
import { DisclaimerIcon, UploadIcon, AlertTriangleIcon, PillIcon, LabBeakerIcon, BookOpenIcon, KeyboardIcon, MicrophoneIcon } from './components/Icons';

type Tab = 'errors' | 'drugs' | 'labs';
type InputMode = 'upload' | 'text' | 'voice';

const App: React.FC = () => {
  // Input and State Management
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [inputText, setInputText] = useState<string>('');
  const [inputMode, setInputMode] = useState<InputMode>('upload');
  
  // Analysis and UI State
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('errors');

  // Voice Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Effect to initialize SpeechRecognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setInputText(prev => prev + finalTranscript);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setError(`Speech recognition error: ${event.error}. Please ensure microphone access is granted.`);
        setIsRecording(false);
      };
      
      recognitionRef.current = recognition;
    }
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      clearAnalysis();
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };
  
  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputText(event.target.value);
      if(analysisResult || error) clearAnalysis();
  }

  const fileToBase64 = (file: File): Promise<{mimeType: string, data: string}> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const mimeType = result.split(';')[0].split(':')[1];
        const base64Data = result.split(',')[1];
        resolve({ mimeType, data: base64Data });
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAnalyze = useCallback(async () => {
    clearAnalysis();
    setIsLoading(true);

    try {
      let result;
      if (inputMode === 'upload' && file) {
        const { mimeType, data } = await fileToBase64(file);
        result = await analyzeHealthDocument(data, mimeType);
      } else if ((inputMode === 'text' || inputMode === 'voice') && inputText.trim()) {
        result = await analyzeHealthText(inputText);
      } else {
        setError("Please provide input before analyzing.");
        setIsLoading(false);
        return;
      }
      setAnalysisResult(result);
    } catch (err) {
      console.error(err);
      setError("An error occurred during analysis. The input may be unclear or the format unsupported. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [file, inputText, inputMode]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
        setError("Speech recognition is not supported in your browser.");
        return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      if (analysisResult || error) clearAnalysis();
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };
  
  const clearInput = () => {
    setFile(null);
    setPreviewUrl(null);
    setInputText('');
    clearAnalysis();
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if(fileInput) fileInput.value = '';
  };
  
  const clearAnalysis = () => {
      setAnalysisResult(null);
      setError(null);
      setActiveTab('errors');
  }

  const riskColorMap: Record<PotentialError['riskLevel'], string> = {
    'High': 'bg-red-100 text-red-800 border-red-400',
    'Moderate': 'bg-yellow-100 text-yellow-800 border-yellow-400',
    'Low': 'bg-blue-100 text-blue-800 border-blue-400',
  };

  const labStatusColorMap: Record<string, string> = {
    'High': 'text-red-600 font-semibold',
    'Low': 'text-blue-600 font-semibold',
    'Abnormal': 'text-yellow-700 font-semibold',
    'Normal': 'text-green-700',
  }

  const isAnalyzeDisabled = isLoading || (inputMode === 'upload' && !file) || (inputMode !== 'upload' && !inputText.trim());
  
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg className="w-8 h-8 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-700 tracking-tight">AI Clinical Pharmacist</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 rounded-md mb-8" role="alert">
            <div className="flex items-start">
              <div className="py-1 shrink-0"><DisclaimerIcon /></div>
              <div className="ml-3">
                <p className="font-bold text-lg">For Clinical Decision Support Only</p>
                <p className="text-sm">This AI tool is designed to support healthcare professionals and is not a substitute for professional medical judgment. Verify all information with clinical guidelines and patient context.</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg transition-all">
            <h2 className="text-xl font-semibold mb-2 text-slate-600">Provide Medical Information</h2>
            <p className="text-sm text-slate-500 mb-6">Choose your input method: upload a document, type text, or use your voice.</p>

            <div className="mb-4 flex justify-center border-b border-slate-200">
                <div className="flex space-x-1 rounded-t-lg bg-slate-100 p-1">
                    <button onClick={() => setInputMode('upload')} className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${inputMode === 'upload' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}><UploadIcon className="w-5 h-5 mr-2" /> Upload</button>
                    <button onClick={() => setInputMode('text')} className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${inputMode === 'text' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}><KeyboardIcon /> Text</button>
                    <button onClick={() => setInputMode('voice')} className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${inputMode === 'voice' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}><MicrophoneIcon /> Voice</button>
                </div>
            </div>

            {inputMode === 'upload' && (
              !previewUrl ? (
                <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                  <UploadIcon />
                  <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                  <p className="text-xs text-slate-400">PNG, JPG, etc.</p>
                  <input id="file-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                </label>
              ) : (
                <div className="relative group w-full md:w-2/3 lg:w-1/2 mx-auto">
                  <img src={previewUrl} alt="Document Preview" className="rounded-lg shadow-md w-full" />
                  <button onClick={clearInput} className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )
            )}

            {(inputMode === 'text' || inputMode === 'voice') && (
              <div>
                <textarea 
                  value={inputText}
                  onChange={handleTextChange}
                  className="w-full h-40 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow"
                  placeholder={inputMode === 'text' ? 'Type or paste medical text here (e.g., Rx: Metformin 500mg PO BID...)' : 'Click the microphone to start dictating medical text...'}
                />
                 {inputMode === 'voice' && (
                    <div className='flex justify-center mt-3'>
                        <button onClick={toggleRecording} className={`flex items-center justify-center px-4 py-2 rounded-lg font-semibold text-white transition-colors ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}>
                            <MicrophoneIcon className={`w-5 h-5 mr-2 ${isRecording ? 'animate-pulse' : ''}`} />
                            {isRecording ? 'Stop Recording' : 'Start Recording'}
                        </button>
                    </div>
                )}
              </div>
            )}
            
            <div className="flex justify-center mt-6">
              <button onClick={handleAnalyze} disabled={isAnalyzeDisabled} className="w-full sm:w-auto flex items-center justify-center px-8 py-3 bg-teal-500 text-white font-bold rounded-lg shadow-md hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all">
                {isLoading ? (
                  <><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Analyzing...</>
                ) : 'Run Clinical Analysis'}
              </button>
            </div>
          </div>
          
          {error && (
            <div className="mt-8 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {analysisResult && (
            <div className="mt-8 bg-white p-4 sm:p-6 rounded-xl shadow-lg">
              <div className="border-b border-slate-200 mb-4">
                <nav className="-mb-px flex space-x-4 sm:space-x-8" aria-label="Tabs">
                  <button onClick={() => setActiveTab('errors')} className={`whitespace-nowrap flex items-center py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'errors' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}><AlertTriangleIcon /> <span className='ml-2'>Error Analysis</span></button>
                  <button onClick={() => setActiveTab('drugs')} className={`whitespace-nowrap flex items-center py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'drugs' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}><PillIcon /> <span className='ml-2'>Drug Deep-Dive</span></button>
                  <button onClick={() => setActiveTab('labs')} className={`whitespace-nowrap flex items-center py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'labs' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}><LabBeakerIcon /> <span className='ml-2'>Lab Insights</span></button>
                </nav>
              </div>

              <div>
                {activeTab === 'errors' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-800">Potential Medication Errors</h3>
                    {(analysisResult.potentialErrors?.length || 0) > 0 ? (
                      analysisResult.potentialErrors.map((item, index) => (
                        <div key={index} className={`p-4 rounded-lg border-l-4 ${riskColorMap[item.riskLevel]}`}>
                          <div className='flex justify-between items-start'>
                             <p className="font-bold">{item.errorType}</p>
                             <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${riskColorMap[item.riskLevel]}`}>{item.riskLevel} Risk</span>
                          </div>
                          <p className="mt-2 text-sm">{item.error}</p>
                          <div className='mt-3 border-t border-slate-300/50 pt-3'>
                            <p className='font-semibold text-sm flex items-center'><BookOpenIcon/> <span className='ml-2'>Clinical Rationale</span></p>
                            <p className="mt-1 text-sm">{item.explanation}</p>
                          </div>
                        </div>
                      ))
                    ) : ( <p className="text-slate-500 text-sm p-4 bg-green-50 border border-green-200 rounded-md">No potential medication errors were identified based on the provided document.</p> )}
                  </div>
                )}
                {activeTab === 'drugs' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-slate-800">Prescribed Drug Information</h3>
                    {(analysisResult.drugInformation?.length || 0) > 0 ? (
                       analysisResult.drugInformation.map((drug, index) => (
                        <div key={index} className="border border-slate-200 rounded-lg p-4">
                           <h4 className="font-bold text-lg text-slate-800">{drug.drugName}</h4>
                           <p className='text-sm text-slate-500 italic'>{drug.drugClass}</p>
                           <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div><strong className="font-semibold text-slate-600 block">Indication:</strong> {drug.indication}</div>
                              <div><strong className="font-semibold text-slate-600 block">Mechanism:</strong> {drug.mechanismOfAction}</div>
                              <div><strong className="font-semibold text-slate-600 block">Dosing:</strong> Prescribed: {drug.prescribedDose} (Standard: {drug.standardDose})</div>
                              <div><strong className="font-semibold text-slate-600 block">Monitoring:</strong> {drug.monitoring}</div>
                              <div className='md:col-span-2'><strong className="font-semibold text-slate-600 block">Adverse Effects:</strong> {drug.adverseEffects}</div>
                              <div className='md:col-span-2'><strong className="font-semibold text-slate-600 block">Precautions:</strong> {drug.precautions}</div>
                           </div>
                        </div>
                      ))
                    ) : ( <p className="text-slate-500 text-sm">No specific drug information could be extracted from the document.</p> )}
                  </div>
                )}
                {activeTab === 'labs' && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Lab Value Interpretation</h3>
                    {(analysisResult.labInterpretation?.length || 0) > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Parameter</th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Result</th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Interpretation</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-slate-200">
                            {analysisResult.labInterpretation.map((lab, index) => (
                              <tr key={index}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{lab.parameter}</td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm ${labStatusColorMap[lab.status] || 'text-slate-600'}`}>{lab.value} {lab.unit}</td>
                                <td className="px-6 py-4 text-sm text-slate-600">{lab.interpretation}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : ( <p className="text-slate-500 text-sm">No lab values were identified or interpreted from the document.</p> )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// Fix: Add comprehensive type definitions for the Web Speech API to resolve TypeScript errors.
// Add SpeechRecognition types to window object
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }

  const SpeechRecognition: {
    prototype: SpeechRecognition;
    new (): SpeechRecognition;
  };
  
  const webkitSpeechRecognition: {
    prototype: SpeechRecognition;
    new (): SpeechRecognition;
  };

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    start: () => void;
    stop: () => void;
  }

  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
  }
}

export default App;
