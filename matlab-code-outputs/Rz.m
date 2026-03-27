
function R = Rz(psi)
% Rotation matrix about z-axis

    c = cos(psi);
    s = sin(psi);
    
    R = [c -s  0;
         s  c  0;
         0  0  1];
end