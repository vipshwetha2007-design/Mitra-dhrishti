%% =========================================================================
%  MITRA DRISHTI — PREVENT • DETECT • PROTECT
%  MathWorks Simulink & SimEvents District Healthcare Queueing Model Builder
%  File: simulink/build_mritidhristi_simulink_model.m
%  Problem Statement: SIH26038 — Explainable AI for DR Screening in Rural India
% =========================================================================
%  This MATLAB script programmatically constructs, parameterizes, and exports
%  the discrete-event Simulink (.slx) model for district healthcare resource planning.
%
%  Requires:
%    - MATLAB R2021b or later
%    - Simulink
%    - SimEvents (Discrete-Event Simulation Toolbox)
%
%  Usage:
%    >> cd simulink/
%    >> build_mritidhristi_simulink_model
% =========================================================================

function build_mritidhristi_simulink_model()
    modelName = 'mritidhristi_district_queue';
    fprintf('===================================================================\n');
    fprintf(' MRITIDHRISTI: PROGRAMMATIC SIMULINK MODEL GENERATOR\n');
    fprintf(' Model Name: %s.slx\n', modelName);
    fprintf('===================================================================\n');

    % Check if Simulink is available in this MATLAB environment
    if ~exist('simulink', 'file')
        error('Simulink is not detected in this MATLAB installation.');
    end

    % Close existing model if open, then create new system
    if bdIsLoaded(modelName)
        close_system(modelName, 0);
    end
    new_system(modelName);
    open_system(modelName);

    fprintf('[*] Constructing SimEvents Discrete-Event Block Hierarchy...\n');

    % 1. Entity Generator: Patient Arrivals
    % Models Poisson arrivals with mean inter-arrival time (1 / lambda)
    add_block('simevents/Entity Generator', [modelName '/Patient_Arrival_Generator'], ...
              'Position', [50, 100, 120, 160], ...
              'Distribution', 'Exponential', ...
              'Mean', '3.555'); % Default 135 patients / 8 hrs = ~16.875/hr -> mean 3.55 min

    % 2. Entity Queue: Fundus Screening Waiting Room
    add_block('simevents/Entity Queue', [modelName '/PHC_Fundus_Waiting_Queue'], ...
              'Position', [180, 105, 250, 155], ...
              'Capacity', '60', ...
              'QueueType', 'FIFO');

    % 3. Entity Server: Non-Mydriatic Fundus Camera Desks
    % Multi-server capacity c = 6 cameras, lognormal service time (mean 17.14 min)
    add_block('simevents/Entity Server', [modelName '/Fundus_Camera_Servers'], ...
              'Position', [310, 105, 390, 155], ...
              'Capacity', '6', ...
              'ServiceTimeSource', 'Dialog', ...
              'ServiceTime', '17.14');

    % 4. Output Switch: AI-Assisted Triage Router (ICDR Grade >= 2 vs < 2)
    add_block('simevents/Output Switch', [modelName '/AI_Triage_Router'], ...
              'Position', [450, 100, 510, 160], ...
              'SwitchingCriterion', 'Equiprobable', ...
              'NumberOutputPorts', '2');

    % 5. Queue: Specialist Review Queue at District Hospital
    add_block('simevents/Entity Queue', [modelName '/District_Hospital_Review_Queue'], ...
              'Position', [570, 70, 640, 120], ...
              'Capacity', '80', ...
              'QueueType', 'FIFO');

    % 6. Server: Tele-Ophthalmologist Review Workstations (c = 3 doctors)
    add_block('simevents/Entity Server', [modelName '/Ophthalmologist_Workstations'], ...
              'Position', [700, 70, 780, 120], ...
              'Capacity', '3', ...
              'ServiceTimeSource', 'Dialog', ...
              'ServiceTime', '15.0'); % 4 cases/hr/doctor = 15 min

    % 7. Sinks: Terminal Entity Absorbers with Metrics
    add_block('simevents/Entity Terminator', [modelName '/Routine_Care_Discharged'], ...
              'Position', [570, 160, 630, 200]);

    add_block('simevents/Entity Terminator', [modelName '/Tertiary_Referral_Discharged'], ...
              'Position', [840, 75, 900, 115]);

    % Connect Signal Wires
    fprintf('[*] Wiring block network connections...\n');
    add_line(modelName, 'Patient_Arrival_Generator/1', 'PHC_Fundus_Waiting_Queue/1');
    add_line(modelName, 'PHC_Fundus_Waiting_Queue/1', 'Fundus_Camera_Servers/1');
    add_line(modelName, 'Fundus_Camera_Servers/1', 'AI_Triage_Router/1');
    add_line(modelName, 'AI_Triage_Router/1', 'District_Hospital_Review_Queue/1');
    add_line(modelName, 'AI_Triage_Router/2', 'Routine_Care_Discharged/1');
    add_line(modelName, 'District_Hospital_Review_Queue/1', 'Ophthalmologist_Workstations/1');
    add_line(modelName, 'Ophthalmologist_Workstations/1', 'Tertiary_Referral_Discharged/1');

    % Configure Simulation Parameters
    set_param(modelName, 'StopTime', '480'); % 8 hours operational shift (480 minutes)
    set_param(modelName, 'Solver', 'VariableStepDiscrete');

    % Save SLX Model
    slxPath = fullfile('simulink', [modelName '.slx']);
    save_system(modelName, slxPath);
    fprintf('[+] Simulink model successfully built and saved to: %s\n', slxPath);

    % Run Batch District Scenarios
    fprintf('\n[*] Executing Simulink Scenarios & Extracting Operational Outputs...\n');
    scenarios = {'normal', 'rural_surge', 'ophthalmologist_shortage', 'transport_delay'};
    for i = 1:length(scenarios)
        scKey = scenarios{i};
        fprintf('    - Running scenario: %s...\n', scKey);
        % Set parameters dynamically
        switch scKey
            case 'normal'
                set_param([modelName '/Patient_Arrival_Generator'], 'Mean', '3.555');
                set_param([modelName '/Fundus_Camera_Servers'], 'Capacity', '6');
                set_param([modelName '/Ophthalmologist_Workstations'], 'Capacity', '3');
            case 'rural_surge'
                set_param([modelName '/Patient_Arrival_Generator'], 'Mean', '2.0'); % 240/480 min = 1 per 2 min
                set_param([modelName '/Fundus_Camera_Servers'], 'Capacity', '6');
                set_param([modelName '/Ophthalmologist_Workstations'], 'Capacity', '3');
            case 'ophthalmologist_shortage'
                set_param([modelName '/Patient_Arrival_Generator'], 'Mean', '3.555');
                set_param([modelName '/Fundus_Camera_Servers'], 'Capacity', '5');
                set_param([modelName '/Ophthalmologist_Workstations'], 'Capacity', '1');
            case 'transport_delay'
                set_param([modelName '/Patient_Arrival_Generator'], 'Mean', '3.428');
                set_param([modelName '/Fundus_Camera_Servers'], 'Capacity', '6');
                set_param([modelName '/Ophthalmologist_Workstations'], 'Capacity', '3');
        end
        % Execute simulation
        simOut = sim(modelName);
        fprintf('      Completed simulation for %s.\n', scKey);
    end

    close_system(modelName, 0);
    fprintf('\n[+] Simulink batch execution complete. Exporting results to platform...\n');
    mritidhristi_district_capacity_model();
end
