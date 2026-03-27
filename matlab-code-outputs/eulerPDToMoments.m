

function M_d_b = eulerPDToMoments( ...
                                e_eta, ...
                                e_eta_dot, ...
                                Kp, Kd)

% PD controller using Euler-angle error and its derivative.
% Desired Euler angle rates are assumed zero.    
    e_eta = wrapToPiLocal(e_eta);

    M_d_b = Kp * e_eta + Kd * e_eta_dot;    
   
end

function a = wrapToPiLocal(a)
    a = mod(a + pi, 2*pi) - pi;
end